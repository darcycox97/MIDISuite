const midiPlayer = require('./src/midiPlayer');
const midiAnimation = require('./src/midiAnimation');
const remote = require('electron').remote;
const dialog = remote.dialog;
const path = require('path');

var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');
var fileInput = document.getElementById('fileInput');
var fileInputDisplay = document.getElementById('fileInputDisplay');

playButton.addEventListener('click', function(event) {
    midiAnimation.start();
});

pauseButton.addEventListener('click', function(event) {
    midiAnimation.pause();
});

// assumes the file is located in ./res/*
fileInput.addEventListener('click', function(event) {
    dialog.showOpenDialog({
        filters: [
            {
                name: "MIDI Files",
                extensions: ["mid"]
            }
        ]
    },(filePaths) => {
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
});

// noteOn & noteOff events contains the midi note number
addEventListener('noteOn', function(event) {
    midiAnimation.queueNoteOn(event.detail);
});

addEventListener('noteOff', function(event) {
    midiAnimation.queueNoteOff(event.detail);
});

addEventListener('playNote', function(event) {
    midiPlayer.playNote(event.detail);
});
