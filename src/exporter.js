// module to export the animation to an mp4 file
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');
const async = require('async');
const glob = require('glob');
const buckets = require('buckets-js');

const WIDTH_PATTERN = '$W$';
const HEIGHT_PATTERN = '$H$';
const TMP_DIR = './.tmpMIDISuite';
const FRAME_RATE = 30;

var svgElement = document.getElementById('two').querySelector("svg");
var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
var loader = new Image;
loader.width = canvas.width = 1920;
loader.height = canvas.height = 1080;


// TODO: 
// - Migrate png capture functions to new module ?? or ffmpeg


exports = module.exports = {};

// exports the midi animation to an mp4 file
// takes the pathname to export to.
// returns a Promise which resolves once exporting is complete
exports.export = function (exportPath) {
    return new Promise((resolve) => {
        // get name of export path minus the file extension and directory location
        var exportBasename = path.basename(exportPath, '.mp4');
        console.log('creating tmp folder');
        createTmpFolder()
        .then(() => {
            console.log('capturing all frames');
            return captureAllFrames(exportBasename);
        })
        .then((tmpVideoNames) => {
            console.log('combining videos / producing final video');
            if (tmpVideoNames.length == 0) {
                return combinePNGImagesToMP4(exportBasename, exportPath);
            } else {
                return combineTmpVideos(tmpVideoNames, exportPath);
            }
        })
        .then(() => {
            console.log('cleaning up');
            return cleanup();
        })
        .then(() => {
            console.log('finished exporting');
            resolve();
        });
    });
};

////////////////////// FUNCTIONS /////////////////////////////////////

// captures all frames of the midi animation and saves them as pngs.
// temp videos are made once a threshold of pngs are reached to save disk space
// (since ffmpeg compresses the data very well).
// takes the basename of the export file so we know what to name the temp files. 
// returns a promise that resolves once all frames have been written to disk.
// the promise returns all the names of the temporary videos so we can combine them
function captureAllFrames(basename) {
    return new Promise((resolve) => {
        var frameCount = 0;
        var tmpVideoCount = 0;
        var tmpVideoNames = [];
        var incrementLength = 1 / FRAME_RATE;
        var pngFileName = constructNumberedFileName(basename, frameCount, 'png');

        midiAnimation.setExporting(true);

        // wrap the following block of code so that the captureSingleFrame can be called again
        // after its promise is resolved (i.e so we don't have to register the callback over and over)
        var wrapper = function () {
            captureSingleFrame(pngFileName)
            .then(() => {
                if (!midiAnimation.finished()) {
                    if (frameCount >= 500) {
                        // once we hit the max number of pngs we want on disk,
                        // create a temp mp4 to save space
                        frameCount = 0;
                        pngFileName = constructNumberedFileName(basename, frameCount, 'png');
                        midiAnimation.skipForwardBySeconds(incrementLength);

                        var tmpVideoName = constructNumberedFileName(basename, tmpVideoCount, 'mp4');
                        tmpVideoNames.push(tmpVideoName);
                        tmpVideoCount++;
                        combinePNGImagesToMP4(basename, tmpVideoName)
                            .then(deletePNGsInTmpFolder)
                            .then(wrapper);
                    } else {
                        frameCount++;
                        midiAnimation.skipForwardBySeconds(incrementLength);
                        pngFileName = constructNumberedFileName(basename, frameCount, 'png');
                        wrapper();
                    }
                } else {
                    midiAnimation.setExporting(false);

                    // all frames are captured. we need to combine any excess pngs into a temp mp4
                    var tmpVideoName = constructNumberedFileName(basename, tmpVideoCount, 'mp4');
                    tmpVideoNames.push(tmpVideoName);
                    combinePNGImagesToMP4(basename, tmpVideoName)
                        .then(deletePNGsInTmpFolder)
                        .then(() => resolve(tmpVideoNames));
                }
            });
        }

        wrapper();
    });
}

// captures a single frame for our video - the image will match what is currently on the canvas. 
function captureSingleFrame(pngFileName) {
    return new Promise((resolve) => {
        getPNGData()
        .then((pngData) => {
            // promise is resolved when png is written to disk
            writePNGToDisk(pngFileName, pngData)})
        .then(resolve);
    });
}

// to be called after all exporting is complete.
// delete the temporary folder and all its contents
function cleanup() {
    return new Promise((resolve) => {
        deleteFilesInTmpFolder('*')
        .then(() => {
            fs.rmdirSync(TMP_DIR);
            resolve();
        });
    });
}

// combines all pngs numbered from 00000 upwards into an mp4 video whose
// location is specified by outputPath.
function combinePNGImagesToMP4(basename, outputPath) {
    return new Promise((resolve) => {
        var inputFiles = TMP_DIR + '/' + basename + '-%05d.png';
        child_process.exec(
            'ffmpeg -y -r ' + FRAME_RATE + ' -f image2 -s 1920x1080 -i ' + inputFiles + ' -vcodec libx264 -crf 15  -pix_fmt yuv420p ' + outputPath,
            (err, stdOut, stdErr) => {
                if (err) throw err;
                resolve();
            }
        );
    });
}

// combines the videos specified in the tmpVideoNames array and writes the
// result into the location specified by exportPath.
function combineTmpVideos(tmpVideoNames, exportPath) {
    return new Promise((resolve) => {
        var namesFile = path.join(TMP_DIR, 'tmpVideos.txt');

        var fd = fs.openSync(namesFile, 'w');
        tmpVideoNames.forEach((videoName) => {
            fs.writeSync(fd, 'file ' + videoName.replace('\\', '/') + os.EOL);
        });
        fs.closeSync(fd);

        // this ffmpeg call looks in the specified file and combines each video specified by
        // new lines in the file
        child_process.exec(
            'ffmpeg -f concat -safe 0 -i '+ namesFile + ' -c copy ' + exportPath,
            (err) => {
                if (err) throw err;
                resolve();
            }
        );
    });
}

// takes a filename, a number, and a file extension. Constructs the numbered filename
// which is {basename}-{ddddd}.{ext}
function constructNumberedFileName(basename, n, ext) {
    // add padding zeros so number is always 5 digits
    if (n < 99999) {
        n = ('0000' + n).slice(-5);
    }

    var fileName = path.join(TMP_DIR, basename + '-' + n + '.' + ext);
    return fileName;    
}

// creates a temporary folder to use as a workspace while we are exporting.
function createTmpFolder(resolve) {
    return new Promise((resolve) => {
        fs.access(TMP_DIR, (err) => {
            if (err) {
                // tmp folder does not exist, create it.
                fs.mkdir(TMP_DIR, (err) => {
                    if (err) throw err;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

// applies a glob search inside the tmp folder using searchPattern and deletes
// all files matching this
function deleteFilesInTmpFolder(searchPattern) {
    return new Promise((resolve) => {
        glob(path.join(TMP_DIR, searchPattern), (err, filenames) => {
            if (err) throw err;
            var promises = [];
            filenames.forEach((filename) => {
                promises.push(
                    new Promise((res, rej) => {
                        fs.unlink(filename, (err) => {
                            if (err) throw err;
                            res();
                        });
                    })
                );
            });

            // wait for all deletions to finish before resolving the promise
            Promise.all(promises).then(resolve);
        });
    });
}

// deletes all temporary mp4s in the tmp folder with the
// specified basename. Returns a promise.
function deleteMP4sInTmpFolder() {
    return deleteFilesInTmpFolder('*.mp4');
}

// deletes all temporary pngs in the tmp folder with the
// specified basename. Returns a promise.
function deletePNGsInTmpFolder() {
    return deleteFilesInTmpFolder('*.png');
}

// captures the current state of the animation and returns a promise which when resolved
// passes an array buffer containing the captured PNG data.
function getPNGData() {
    return new Promise((resolve) => {
        // called whenever the image src has been set and has finished loading
        loader.onload = () => {
            // add the loaded image to the canvas and redraw the background
            ctx.clearRect(0, 0, 1920, 1080);
            ctx.drawImage(midiAnimation.backgroundImage(), 0, 0, 1920, 1080);
            ctx.drawImage(loader, 0, 0, 1920, 1080);

            // extract the binary data from the canvas (a "blob")
            canvas.toBlob((blob) => {
                // set event listener for when the data is ready then read the blob as
                // a buffer so we can easily write it to a png file
                var reader = new FileReader();
                reader.onloadend = () => {
                    var buffer = Buffer.from(reader.result);
                    resolve(buffer);
                };

                reader.readAsArrayBuffer(blob);
            });
        };

        loader.src = getSVGAsDataURL();
    });
}

// takes the current state of the svg element and produces a data uri representing 
// an svg image.
function getSVGAsDataURL() {
    var svgAsXML = (new XMLSerializer).serializeToString(svgElement);
    return 'data:image/svg+xml,' + encodeURIComponent(svgAsXML);
}

// write the contents of the provided buffer to the specified file
// returns a promise
function writePNGToDisk(fileName, pngData) {
    return new Promise((resolve) => {
        fs.open(fileName, 'w', (err, fd) => {
            if (err) throw err;

            // writing synchronously appears to be better on memory usage
            fs.writeSync(fd, pngData);
            pngData = null;
            fs.close(fd, (err) => {
                if (err) throw err;
                resolve();
            });
        });
    });
}