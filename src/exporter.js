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

// returns the path to save the nth png capture of the specified export basename
function constructPNGFileName(basename, n) {
    // add padding zeros so number is always 5 digits
    if (n < 99999) {
        n = ('0000' + n).slice(-5);
    }

    var fileName = path.join(TMP_DIR, basename + '-' + n + '.png');
    return fileName;
}

// takes the current state of the svg element and produces a data uri representing 
// an svg image.
function getSVGAsDataURL() {
    var svgAsXML = (new XMLSerializer).serializeToString(svgElement);
    return 'data:image/svg+xml,' + encodeURIComponent(svgAsXML);
}

// captures the current state of the animation and writes it to a png
function getPNGBuffer(callback) {

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
                callback(buffer);
            };

            reader.readAsArrayBuffer(blob);
        });
    };

    loader.src = getSVGAsDataURL();
}

// used as a task to write a png file to disk
// 'this' should be bound to an object with properties:
// data: the buffer containing the png data
// fileName: the filename to write to
function writePNGToDisk(callback) {
    fs.open(this.fileName, 'w', (err, fd) => {
        if (err) throw err;
        fs.write(fd, this.data, (err) => {
            if (err) throw err;
            fs.close(fd, (err) => {
                if (err) throw err;
                // deference object so it is garbage collected
                this.fileName = null;
                this.data = null;
                callback();
            });
        });
    });
}


exports = module.exports = {};

// exports the midi animation to an mp4 file
// takes the pathname to export to and a callback 
// which is called when exporting is finished
exports.export = function (exportPath, callback) {

    // get name of export path minus the file extension and directory location
    var exportName = path.basename(exportPath, '.mp4');

    var tasks = [];

    // check that the tmp folder exists, if not create it
    var createTmpFolder = function (callback) {
        console.log('running create tmp folder');
        fs.access(TMP_DIR, (err) => {
            if (err) {
                fs.mkdir(TMP_DIR, (err) => {
                    if (err) throw err;
                    callback();
                });
            } else {
                callback();
            }
        });
    };

    // take snapshots of the animation at 1/FRAME_RATE second intervals.
    var captureAllFrames = function (callback) {

        console.log('capturing all frames');

        var pngWriteQueue = buckets.Queue();

        midiAnimation.setExporting(true);

        var frameCount = 0;
        var incrementLength = 1 / FRAME_RATE;
        var pngFileName = constructPNGFileName(exportName, frameCount);

        // whether or not we are writing pngs to disk at the moment
        var isWriting = false;
    
        // define behaviour when the current frame has been captured.
        // it should update the filename, count, and animation state
        // then capture again until the animation is complete.
        // also add to the PNG write queue which will periodically write to 
        // the disk
        var postCaptureCallback = function (capturedPNGBuffer) {

            pngWriteQueue.enqueue({ data: capturedPNGBuffer, fileName: pngFileName });

            // once we have queued up a decent amount of pngs, write them out to disk
            // allowing 5 writes simultaneously. Only do this is we are not already
            // writing
            if (pngWriteQueue.size() >= 10 && !isWriting) {
                isWriting = true;
                var tasks = [];
                while (!pngWriteQueue.isEmpty()) {
                    tasks.push(writePNGToDisk.bind(pngWriteQueue.dequeue()));
                }
                async.parallelLimit(tasks, 5, () => {
                    // derefence the tasks so they are garbage collected (hopefully)
                    tasks = null;
                    isWriting = false;
                });
            }

            if (!midiAnimation.finished()) {
                frameCount++;
                pngFileName = constructPNGFileName(exportName, frameCount);
                midiAnimation.skipForwardBySeconds(incrementLength);
                getPNGBuffer(postCaptureCallback);
            } else {
                // this is the end condition
                // write out any remaining png frames to disk and construct an mp4
                midiAnimation.setExporting(false);
                callback();
            }
        };

        getPNGBuffer(postCaptureCallback);

    };

    tasks.push(createTmpFolder, captureAllFrames);
    async.series(tasks, (err, results) => {
        if (err) throw err;
        // deference so things can be garbage collected
        tasks = null;
        console.log('finished exporting');
        callback();
    });

    var deletePNGs = function (callback) {
        console.log('cleaning up');

        var rmFile = function (cb) {
            fs.unlink(this.fileName, (err) => {
                if (err) throw err;
                cb();
            });
        };

        var deleteTasks = [];
        glob(path.join(TMP_DIR, exportName + '-*.png'), (err, filenames) => {
            if (err) throw err;
            filenames.forEach((file) => {
                deleteTasks.push(rmFile.bind({ fileName: file }));
            });

            async.parallelLimit(deleteTasks, 5, callback);
        });
    };
};
