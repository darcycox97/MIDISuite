var exports = module.exports = {};

var buckets = require('buckets-js'); // for queue data structure

var inactiveColor = 'rgba(0, 200, 255, 0.75)';
var activeColor = 'rgba(200, 100, 0, 0.75)';

// initialize the canvas
var elem = document.getElementById('two');
var two = new Two({ width:2000, height:500 }).appendTo(elem);

var notes = [];
var width = 40;
var height = 100;

for (var i = 0; i < 88; i++) {
    var note = two.makeRectangle(i * width, 0, width, height);
    note.fill = inactiveColor;
    notes[i] = note;
}

var group = two.makeGroup(notes);
group.translation.set(40, two.height / 2);
group.scale = 0.5;

two.update();


var activeNoteQueue = buckets.Queue();
var inactiveNoteQueue = buckets.Queue();
var isPlaying = false;
two.bind('update', function(frameCount) {

    if (isPlaying) {
        if (!activeNoteQueue.isEmpty()) {
            // if the queue has more than one note a chord is probably being played.
            // show up to ten notes at once in this case so they appear simultaneously.
            if (activeNoteQueue.size() > 1) {
                var count = 10;
                while (count > 0 && !activeNoteQueue.isEmpty()) {
                    notes[activeNoteQueue.dequeue()].fill = activeColor;
                    count--;
                }
            } else { // otherwise just show the one note
                notes[activeNoteQueue.dequeue()].fill = activeColor;
            }
        }
        if (!inactiveNoteQueue.isEmpty()) {
            notes[inactiveNoteQueue.dequeue()].fill = inactiveColor;
        }
    } else {
        notes.forEach(function(note) {
            note.fill = inactiveColor;
        });
        activeNoteQueue.clear();
        inactiveNoteQueue.clear();
    }

}).play();

exports.stop = function() {
    isPlaying = false;
}

exports.start = function() {
    isPlaying = true;
}

// adds to the note on queue. will show the note as played.
// note should be a piano key: between 0 and 87 inclusive
exports.queueNoteOn = function(noteCode) {
    activeNoteQueue.enqueue(noteCode);
}

// adds to the note off queue. will stop showing this note.
// note code should be between 0 and 87 inclusive
exports.queueNoteOff = function(noteCode) {
    inactiveNoteQueue.enqueue(noteCode);
}
