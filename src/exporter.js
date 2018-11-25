// module to export the animation to an mp4 file
const fs = require('fs');
const os = require('os');
const svgexport = require('svgexport');
const child_process = require('child_process');
const async = require('async');
const glob = require('glob');

const WIDTH_PATTERN = '$W$';
const HEIGHT_PATTERN = '$H$';
const TMP_DIR = './.tmpMIDISuite';
const FRAME_RATE = 15;

var svgElement = document.getElementById('two').querySelector("svg");
// todo set width and height to same as two-js canvas size
var svgWrapperStart = '<svg width="$W$" height="$H$" xmlns="http://www.w3.org/2000/svg"' +
' xmlns:xlink="http://www.w3.org/1999/xlink">';
var svgWrapperEnd = '</svg>';

function captureSVGFile(fileName, dimensions, callback) {
    var svgStart = svgWrapperStart.replace(WIDTH_PATTERN, dimensions.width).
    replace(HEIGHT_PATTERN, dimensions.height);
    fs.open(fileName, 'w', (err, fd) => {
        if (err) throw err;
        fs.write(fd, svgStart + svgElement.innerHTML + svgWrapperEnd, (err) => {
            if (err) throw err;
            fs.close(fd, (err) => {
                if (err) throw err;
                callback(); // notify caller that new svg can be captured
            });
        });
    });
}

function convertSVGFilesToPNG(basename, callback) {
    glob(path.join(TMP_DIR, basename + '-*.svg'), (err, filenames) => {

        if (err) throw err;

        // task to convert an svg to a png. callback is called when complete
        var fileIndex = 0;
        var svgToPNGCall = function(cb) {
            var svgFile = this.file;
            child_process.exec(
                'svgexport ' + svgFile + ' ' + svgFile.replace('svg', 'png') + ' 852:480',
                (err, stdOut, stdErr) => {
                    if (err) throw err;
                    // then delete the svg to minimise space taken up
                    fs.unlink(svgFile, (err) => {
                        if (err) throw err;
                        cb();
                    });
                }
            );
        };


        var tasks = [];
        filenames.forEach((svgFile) => {
            tasks.push(svgToPNGCall.bind({file: svgFile}));
        });

        // allow 3 processes to run at once so the system doesn't overload
        async.parallelLimit(tasks, 3, callback);

    });
}

function combinePNGImagesToMP4(basename, outputPath, callback) {
    var inputFiles = TMP_DIR + '/' + basename + '-%05d.png';
    child_process.exec(
        'ffmpeg -y -r ' + FRAME_RATE + ' -f image2 -s 852x480 -i ' + inputFiles + ' -vcodec libx264 -crf 15  -pix_fmt yuv420p ' + outputPath,
        (err, stdOut, stdErr) => {
            if (err) throw err;
            console.log(stdErr);
            console.log(stdOut);
            callback();
        }
    );
}

// returns the path to save the nth svg capture of the specified export basename
function constructSVGFileName(basename, n) {
    // add padding zeros so number is always 5 digits
    if (n < 99999) {
        n = ('0000' + n).slice(-5);
    }

    var fileName = path.join(TMP_DIR, basename + '-' + n + '.svg');

    return fileName;
}

exports = module.exports = {};

// exports the midi animation to an mp4 file
// takes the pathname to export to, the dimensions of the canvas (so the viewport is correct),
// and a callback
exports.export = function(exportPath, dimensions, callback) {

    // get name of export path minus the file extension and directory location
    var exportName = path.basename(exportPath, '.mp4');

    var tasks = [];

    // check that the tmp folder exists, if not create it
    var createTmpFolder = function(callback) {
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

    // export svg files of the animation at 1/FRAME_RATE second intervals.
    var captureSVGFiles = function(callback) {

        console.log('capturing the svg files');

        midiAnimation.setExporting(true);

        var svgCount = 0;
        var incrementLength = 1/FRAME_RATE;
        var svgFileName = constructSVGFileName(exportName, svgCount);
        // define behaviour when the capture svg function completes.
        // it should update the filename, count, and animation state
        // then call itself again until the animation is complete
        var postCaptureCallback = function() {
            if (!midiAnimation.finished()) {
                svgCount++;
                svgFileName = constructSVGFileName(exportName, svgCount);
                midiAnimation.skipForwardBySeconds(incrementLength);
                captureSVGFile(svgFileName, dimensions, postCaptureCallback);
            } else {
                // this is the end condition
                midiAnimation.setExporting(false);
                callback();
            }
        };

        captureSVGFile(svgFileName, dimensions, postCaptureCallback);

    };

    var convertSVGToPNG = function(callback) {
        console.log('converting to png');
        convertSVGFilesToPNG(exportName, callback);
    };

    var convertPNGsToMP4 = function(callback) {
        console.log('constructing mp4');
        combinePNGImagesToMP4(exportName, exportPath, callback);
    };

    var deletePNGs = function(callback) {
        console.log('cleaning up');

        var rmFile = function(cb) {
            fs.unlink(this.fileName, (err) => {
                if (err) throw err;
                cb();
            });
        };

        var deleteTasks = [];
        glob(path.join(TMP_DIR, exportName + '-*.png'), (err, filenames) => {
            if (err) throw err;
            filenames.forEach((file) => {
                deleteTasks.push(rmFile.bind({fileName: file}));
            });

            async.parallelLimit(deleteTasks, 5, callback);
        });
    };

    tasks.push(createTmpFolder, captureSVGFiles, convertSVGToPNG, convertPNGsToMP4, deletePNGs);

    async.series(tasks, (err, results) => {
        if (err) throw err;
        console.log('finished exporting');
    });


};
