var midiPlayer = require('./src/midiPlayer');
var midiAnimation = require('./src/midiAnimation');

var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');
var fileInput = document.getElementById('fileInput');

playButton.addEventListener('click', function(event) {
    midiAnimation.start();
});

pauseButton.addEventListener('click', function(event) {
    midiAnimation.pause();
});

// assumes the file is located in ./res/*
fileInput.addEventListener('input', function(event) {
    var fileName = fileInput.files[0].name;
    midiPlayer.initialize('./res/' + fileName, (noteQueues) => {
        playButton.disabled = false;
        pauseButton.disabled = false;
        midiAnimation.initialize(noteQueues);
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
