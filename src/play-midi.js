const midiPlayer = require('./src/midiPlayer');
const midiAnimation = require('./src/midiAnimation');
const remote = require('electron').remote;
const dialog = remote.dialog;
const path = require('path');
const exporter = require('./src/exporter');

var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');
var exportButton = document.getElementById('exportBtn');
var fileInput = document.getElementById('fileInput');
var fileInputDisplay = document.getElementById('fileInputDisplay');

playButton.addEventListener('click', function(event) {
    midiAnimation.start();
});

pauseButton.addEventListener('click', function(event) {
    midiAnimation.pause();
});

exportButton.addEventListener('click', function(event) {
    exportPath = dialog.showSaveDialog({
        filters: [
            {
                name: "MP4",
                extensions: ["mp4"]
            }
        ]
    });
    if (!exportPath) return;

    exportButton.disabled = true;
    playButton.disabled = true;
    pauseButton.disabled = true;
    fileInput.disabled = true;

    exporter.export(exportPath)
    .then(() => {
        exportButton.disabled = false;
        playButton.disabled = false;
        pauseButton.disabled = false;
        fileInput.disabled = false;
    });
});

fileInput.addEventListener('click', function(event) {
    filePaths = dialog.showOpenDialog({
        filters: [
            {
                name: "MIDI Files",
                extensions: ["mid"]
            }
        ]
    });
    if (!filePaths) return;
    var midiFile = filePaths[0];
    // use the midiPlayer to parse the file and send the output to
    // the animation module so it can draw the notes etc
    midiPlayer.initialize(midiFile, (noteQueues) => {
        playButton.disabled = false;
        pauseButton.disabled = false;
        midiAnimation.initialize(noteQueues);
    });
    fileInputDisplay.innerHTML = path.basename(midiFile);
});


imageInput.addEventListener('click', function(event) {
    imagePaths = dialog.showOpenDialog({
        filters: [
            {
                name: "Images",
                extensions: ["png", "jpg"]
            }
        ]
    });
    if (!imagePaths) return;
    var bgImage = imagePaths[0];

    console.log('updating with ' + bgImage);
    midiAnimation.setBackgroundImagePath(bgImage);
    imageInputDisplay.innerHTML = path.basename(bgImage);
});

addEventListener('playNote', function(event) {
    midiPlayer.playNote(event.detail);
});
