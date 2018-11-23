// module to export the animation to an mp4 file
const fs = require('fs');
const os = require('os');
const svgexport = require('svgexport');

console.log(svgexport);

const WIDTH_PATTERN = '$W$';
const HEIGHT_PATTERN = '$H$';

var svgElement = document.getElementById('two').querySelector("svg");
var testPath = './test_files/';
var count = 1;
// todo set width and height to same as two-js canvas size
var svgWrapperStart = '<svg width="$W$" height="$H$" xmlns="http://www.w3.org/2000/svg"' +
                        ' xmlns:xlink="http://www.w3.org/1999/xlink">';
var svgWrapperEnd = '</svg>';


function createSvgFile(dimensions) {
    var fileName = testPath + count + '.svg'
    var svgStart = svgWrapperStart.replace(WIDTH_PATTERN, dimensions.width).
                    replace(HEIGHT_PATTERN, dimensions.height);
    count++;
    fs.open(fileName, 'w', (err, fd) => {
        if (err) throw err;
        fs.write(fd, svgStart + svgElement.innerHTML + svgWrapperEnd, (err) => {
            if (err) throw err;
            fs.close(fd, (err) => {
                if (err) throw err;
                console.log('converting to png');
                svgexport.cli([fileName, fileName.replace('.svg', '.png'), '1920:1080']);
            });
        });
    });
}

exports = module.exports = {};
exports.export = createSvgFile;
