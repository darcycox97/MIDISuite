
var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');
var midiPlayer = require('./src/midiPlayer');
var midiAnimation = require('./src/midiAnimation');

midiPlayer.initialize('./res/strange_meadow_lark.mid');

playButton.addEventListener('click', function(event) {
    console.log('clicked play');
    midiPlayer.startPlayer();
    midiAnimation.start();
});

pauseButton.addEventListener('click', function(event) {
    console.log('clicked pause');
    midiPlayer.pausePlayer();
    midiAnimation.stop();
});

// noteOn & noteOff events contains the midi note number
addEventListener('noteOn', function(event) {
    midiAnimation.queueNoteOn(event.detail - 22);
});

addEventListener('noteOff', function(event) {
    midiAnimation.queueNoteOff(event.detail - 22);
})
