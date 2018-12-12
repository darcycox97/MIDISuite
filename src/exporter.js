// module to export the animation to an mp4 file
const fs = require('fs');
const child_process = require('child_process');
const async = require('async');
const glob = require('glob');
const buckets = require('buckets-js');

const WIDTH_PATTERN = '$W$';
const HEIGHT_PATTERN = '$H$';
const TMP_DIR = './.tmpMIDISuite';
const FRAME_RATE = 1;

var svgElement = document.getElementById('two').querySelector("svg");
var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
var loader = new Image;
loader.width = canvas.width = 1920;
loader.height = canvas.height = 1080;


// TODO: 
// - Migrate png capture functions to new module ?? or ffmpeg
// - captureAllFrames should periodically combine the tmp videos then delete the pngs and reset framecount
// - cleanup function (delete any pngs or tmp videos remaining, then delete tmp folder)


exports = module.exports = {};

// exports the midi animation to an mp4 file
// takes the pathname to export to and a callback 
// which is called when exporting is finished
exports.export = function (exportPath, callback) {

    // get name of export path minus the file extension and directory location
    var exportBasename = path.basename(exportPath, '.mp4');

    var tasks = [];

    var captureAllFrames = function (cb) {
        console.log('capturing all frames');

        midiAnimation.setExporting(true);

        var frameCount = 0;
        var incrementLength = 1 / FRAME_RATE;
        var pngFileName = constructNumberedFileName(exportBasename, frameCount, 'png');

        // wrap the following block of code so that the captureSingleFrame can be called again
        // after its promise is resolved (i.e so we don't have to register the callback over and over)
        var wrapper = function() {
            captureSingleFrame(pngFileName)
            .then(() => {
                if (!midiAnimation.finished()) {
                    frameCount++;
                    midiAnimation.skipForwardBySeconds(incrementLength);
                    pngFileName = constructNumberedFileName(exportBasename, frameCount, 'png');
                    wrapper();
                } else {
                    midiAnimation.setExporting(false);
                    cb();
                }
            });
        }

        wrapper();
    }

    var combineTmpVideos = function(cb) {
        cb();
    };

    tasks.push(createTmpFolder, captureAllFrames, combineTmpVideos);
    async.series(tasks, (err, results) => {
        if (err) throw err;
        // deference so things can be garbage collected
        tasks = null;
        console.log('finished exporting');
        callback();
    });

    // ideal way this func will look
    // createTmpFolder()
    // .then(captureAllFrames)
    // .then(combineTmpVideos)
    // .then(cleanup);
};

////////////////////// FUNCTIONS /////////////////////////////////////

// captures a single frame for our video - the image will match what is currently on the canvas. 
function captureSingleFrame(pngFileName) {
    return new Promise((resolve, reject) => {
        getPNGData()
        .then((pngData) => {
            // promise is resolved when png is written to disk
            writePNGToDisk(pngFileName, pngData)})
        .then(resolve);
    });
}

// combines all pngs numbered from 00000 upwards into an mp4 video, specified by outputPath.
function combinePNGImagesToMP4(basename, outputPath, callback) {
    var inputFiles = TMP_DIR + '/' + basename + '-%05d.png';
    child_process.exec(
        'ffmpeg -y -r ' + FRAME_RATE + ' -f image2 -s 1920x1080 -i ' + inputFiles + ' -vcodec libx264 -crf 15  -pix_fmt yuv420p ' + outputPath,
        (err, stdOut, stdErr) => {
            if (err) throw err;
            console.log(stdErr);
            console.log(stdOut);
            callback();
        }
    );
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
function createTmpFolder(callback) {
    console.log('Creating temp folder');
    fs.access(TMP_DIR, (err) => {
        if (err) {
            // tmp folder does not exist, create it.
            fs.mkdir(TMP_DIR, (err) => {
                if (err) throw err;
                callback();
            });
        } else {
            callback();
        }
    });
}

function deletePNGs(basename, callback) {
    console.log('deleting pngs');
    var rmFile = function (cb) {
        fs.unlink(this.fileName, (err) => {
            if (err) throw err;
            cb();
        });
    };

    var deleteTasks = [];
    glob(path.join(TMP_DIR, basename + '-*.png'), (err, filenames) => {
        if (err) throw err;
        filenames.forEach((file) => {
            deleteTasks.push(rmFile.bind({ fileName: file }));
        });

        async.parallelLimit(deleteTasks, 5, callback);
    });
}

// captures the current state of the animation and returns a promise which when resolved
// passes an array buffer containing the captured PNG data.
function getPNGData() {
    return new Promise((resolve, reject) => {
        // called whenever the image src has been set and has finished loading
        loader.onload = () => {
            // add the loaded image to the canvas
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
    return new Promise((resolve, reject) => {
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


    // // take snapshots of the animation at 1/FRAME_RATE second intervals.
    // var captureAllFrames = function (callback) {

    //     console.log('capturing all frames');

    //     // we need a flag to represent when to stop exporting, because asynchronous callbacks
    //     // sometimes think the animation is still going because it has transitioned from finished to 
    //     // not finished (it has been reset when exporting was set to false) without the callback seeing
    //     // that it is finished
    //     var finished = false;

    //     var pngWriteQueue = buckets.Queue();

    //     midiAnimation.setExporting(true);

    //     var frameCount = 0;
    //     var incrementLength = 1 / FRAME_RATE;
    //     var pngFileName = constructNumberedFileName(exportName, frameCount, 'png');

    //     // whether or not we are writing pngs to disk at the moment
    //     var isWriting = false;

    //     // whether or not we should compress the images into a tmp video to save space
    //     var makeTmpVideo = false;
    //     var numTmpVideos = 0;
    //     var tmpVids = [];

    //     // define behaviour when the current frame has been captured.
    //     // it should update the filename, count, and animation state
    //     // then capture again until the animation is complete.
    //     // also add to the PNG write queue which will periodically write to 
    //     // the disk
    //     var postCaptureCallback = function (capturedPNGBuffer) {

    //         if (midiAnimation.finished()) {
    //             finished = true;
    //         }

    //         pngWriteQueue.enqueue({ data: capturedPNGBuffer, fileName: pngFileName });

    //         // once we have queued up a decent amount of pngs, write them out to disk
    //         // allowing 5 writes simultaneously. Only do this is we are not already
    //         // writing
    //         if ((pngWriteQueue.size() >= 10 && !isWriting) || (finished && pngWriteQueue.size() != 0)) {
    //             isWriting = true;
    //             var tasks = [];
    //             while (!pngWriteQueue.isEmpty()) {
    //                 tasks.push(writePNGToDisk.bind(pngWriteQueue.dequeue()));
    //             }
    //             async.parallelLimit(tasks, 10, () => {
    //                 // derefence the tasks so they are garbage collected (hopefully)
    //                 tasks = null;

    //                 // check to see if we should combine pngs into a tmp video then delete them or not
    //                 if (makeTmpVideo) {
    //                     makeTmpVideo = false;
    //                     var vidName = constructNumberedFileName(exportName, numTmpVideos, 'mp4');
    //                     tmpVids.push(vidName);
    //                     numTmpVideos++;
    //                     console.log('making temp video');
    //                     combinePNGImagesToMP4(exportName, vidName, () => {
    //                         deletePNGs(exportName, () => {
    //                             isWriting = false;
    //                             console.log('deleted all pngs');

    //                             if (!finished) {
    //                                 // start capturing frames again if the animation hasn't finished
    //                                 frameCount = 0;
    //                                 pngFileName = constructNumberedFileName(exportName, frameCount, 'png');
    //                                 midiAnimation.skipForwardBySeconds(incrementLength);
    //                                 getPNGBuffer(postCaptureCallback);
    //                             }
    //                         });
    //                     });
    //                 } else {
    //                     isWriting = false;
    //                 }
    //             });
    //              // if a tmp video is about to be made we shouldn't capture anymore frames until it is done
    //             // so we should return from the postCaptureCallback function.
    //             if (makeTmpVideo) {
    //                 return;
    //             }
    //         }

    //         if (!finished) {

    //             frameCount++;

    //             // we should create a video whenever we end up with 500 pngs on disk
    //             // to avoid too much disk space being taken up
    //             if (frameCount == 50) {
    //                 makeTmpVideo = true;
    //             }
    //             pngFileName = constructNumberedFileName(exportName, frameCount, 'png');
    //             midiAnimation.skipForwardBySeconds(incrementLength);
    //             getPNGBuffer(postCaptureCallback);
    //         } else {
    //             // this will reset the animation to its start state
    //             midiAnimation.setExporting(false);
    //             callback();
    //         }
    //     };

    //     getPNGBuffer(postCaptureCallback);

    // };
