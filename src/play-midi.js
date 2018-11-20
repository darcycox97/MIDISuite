
var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');
var midiPlayer = require('./src/midiPlayer');
var midiAnimation = require('./src/midiAnimation');

midiPlayer.initialize('./res/maple_leaf_rag.mid', () => {
    playButton.disabled = false;
    pauseButton.disabled = false;
});

playButton.addEventListener('click', function(event) {
    midiPlayer.startPlayer();
    midiAnimation.start();
});

pauseButton.addEventListener('click', function(event) {
    midiPlayer.pausePlayer();
    midiAnimation.stop();
});

// noteOn & noteOff events contains the midi note number
addEventListener('noteOn', function(event) {
    midiAnimation.queueNoteOn(event.detail);
});

addEventListener('noteOff', function(event) {
    midiAnimation.queueNoteOff(event.detail);
});
