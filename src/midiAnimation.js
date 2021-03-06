//TODO make these globally accessible (just put into module.exports and pass as init parameter to exporter)
//todo toggle full screen
const CANVAS_HEIGHT = 619;
const CANVAS_WIDTH = 1100;
const PREVIEW_HEIGHT = 200;
const PREVIEW_WIDTH = 300;
const NOTE_RADIUS = 3;
const NOTE_HEIGHT = CANVAS_HEIGHT / 88;

var backgroundImgPath;
var backgroundImg;

var buckets = require('buckets-js'); // for queue data structure
var path = require('path');

// initialize the canvas
var elem = document.getElementById('two');
var two = new Two({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).appendTo(elem);

// init preview canvas
var preview = document.getElementById('two-preview');
var twoPreview = new Two({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).appendTo(preview);

// obtain references to UI elements and register listeners for change in values
var scrollSpeed = document.getElementById('scrollSpeed');
var noteColor = document.getElementById('noteColor');
var bgColor = document.getElementById('bgColor');
var playBarColor = document.getElementById('playBarColor');
var noteOpacitySlider = document.getElementById('noteOpacity');

scrollSpeed.addEventListener('input', updateScrollSpeed);

//////////// PREVIEW CANVAS ///////////////////
var previewBackground = twoPreview.makeRectangle(PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2, PREVIEW_WIDTH, PREVIEW_HEIGHT);
previewBackground.noStroke();
previewBackground.fill = bgColor.value;
previewBackground.opacity = 0;
var previewNote = twoPreview.makeRoundedRectangle(PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2, 80, CANVAS_HEIGHT / 88, NOTE_RADIUS);
previewNote.noStroke();
previewNote.fill = noteColor.value;
twoPreview.update();

noteColor.addEventListener('input', function(e) {
    previewNote.fill = noteColor.value;
    twoPreview.update();
    updateNotes();
});

noteOpacitySlider.addEventListener('input', function(e) {
    var opacity = noteOpacitySlider.value / 10;
    previewNote.opacity = opacity;
    twoPreview.update();
    updateNotes();
});

bgColor.addEventListener('input', function(e) {
    previewBackground.fill = bgColor.value;
    twoPreview.update();
    updateBackgroundColor(); // for the main canvas
    updateNotes();
});

playBarColor.addEventListener('input', updatePlayBarColor);

/////////// MAIN ANIMATION LOOP /////////////////////
var noteQueues; // all midi information about the notes
var isPlaying = false;
var isExporting = false;
var timePassed = 0;
// notes that need to be kept track of
var activeNoteQueues = new Array(88);
for (var i = 0; i < 88; i++) {
    activeNoteQueues[i] = buckets.Queue();
}
// keep track of all drawn shapes so we can clear the screen
var allNotes = new Set();
// keep track of how much the scene has moved
var offset = 0;
// units per second (more human readable and easy to work with, adjust this variable to change rate)
var scrollRatePerSecond = scrollSpeed.value;
// units per frame = units per second / frames per second
var scrollRate = scrollRatePerSecond / 60;

var playBarWidth = 3;
var playBar = two.makeRectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, playBarWidth, CANVAS_HEIGHT);
var playBarCollisionPoint = CANVAS_WIDTH / 2 + playBarWidth / 2;
playBar.fill = '#000000';
playBar.opacity = 0.5;
playBar.noStroke();

var background = two.makeRectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT);
background.fill = bgColor.value;
background.opacity = 0;
background.noStroke();

two.bind('update', function() {

    if (isPlaying) {

        // if we are exporting then animation should not match real time
        if (!isExporting && two.timeDelta != undefined) {
            timePassed += two.timeDelta; // in milliseconds
        }

        if (!isExporting) {
            // shifting the scene gives the scrolling effect
            two.scene.translation.x -= scrollRate;
            playBar.translation.x += scrollRate;
            background.translation.x += scrollRate;
            offset += scrollRate;
        }

        // make sure timing is correct so catch up if behind
        var expectedOffset = scrollRatePerSecond * timePassed / 1000;
        if (offset != expectedOffset) {
            offset = expectedOffset;
            two.scene.translation.x = -1 * expectedOffset;
            playBar.translation.x = expectedOffset + CANVAS_WIDTH/2;
            background.translation.x = expectedOffset + CANVAS_WIDTH/2;
        }

        activeNoteQueues.forEach((noteQueue) => {
            if (!noteQueue.isEmpty()) {
                var note = noteQueue.peek();
                if (note.shape.translation.x <= offset + playBarCollisionPoint + note.width / 2) {
                    note.shape.opacity = note.shape.opacity / 5;
                    noteQueue.dequeue();
                    if (!isExporting) {
                        dispatchEvent(new CustomEvent('playNote', {detail: note.pianoNote}));
                    }
                }
            }
        });
    }

}).play();

// helper function to draw a note at the specified index
// adds to the provided queue to keep track of the notes
function drawNote(noteWidth, xOffset, noteIndex, activeNoteQueue) {
    var note = two.makeRoundedRectangle(
        CANVAS_WIDTH + xOffset + noteWidth / 2,
        CANVAS_HEIGHT - noteIndex * NOTE_HEIGHT,
        noteWidth,
        NOTE_HEIGHT,
        NOTE_RADIUS
    );
    note.fill = noteColor.value;
    note.opacity = noteOpacitySlider.value / 10;
    note.stroke = bgColor.value;
    note.lineWidth = 5;
    allNotes.add({shape: note, width: noteWidth});
    activeNoteQueue.enqueue({shape: note, width: noteWidth, pianoNote: noteIndex});
}

// calculates the correct note width so its length on screen matches the notes realtime length
function calculateNoteWidth(noteLengthMillisec) {
    // width = scrollRatePerSec * length in seconds
    return scrollRatePerSecond * noteLengthMillisec / 1000;
}

// calculates how far from the origin (x = 0) this note should
// be drawn so that it plays at the given absolute time in seconds.
// x = 0 means play right now
function calculateNoteOffset(absoluteTimeSec) {
    return scrollRatePerSecond * absoluteTimeSec;
}

function updateScrollSpeed() {
    scrollRatePerSecond = scrollSpeed.value;
    scrollRate = scrollRatePerSecond / 60;
    drawEntireMidiFile();
}

function updateBackgroundColor() {
    background.fill = bgColor.value;
}

function updateNotes() {
    allNotes.forEach((note) => {
        note.shape.fill = noteColor.value;
        note.shape.opacity = noteOpacitySlider.value / 10;
        note.shape.stroke = bgColor.value;
    })
}

function updatePlayBarColor() {
    playBar.fill = playBarColor.value;
}

function drawEntireMidiFile() {

    if (noteQueues != undefined) {
        isPlaying = false;
        timePassed = 0;
        two.scene.translation.clear();
        background.translation.set(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        playBar.translation.set(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        offset = 0;

        allNotes.forEach((note) => {
            two.remove(note.shape);
        });
        allNotes.clear();

        activeNoteQueues.forEach((noteQueue) => {
            noteQueue.clear();
        })

        noteQueues.forEach((noteQueue, pianoNote) => {
            var numNoteEvents = noteQueue.size();
            var activeNoteQueue = activeNoteQueues[pianoNote];
            var count = 0;
            while (count < numNoteEvents) {
                var noteInfo = noteQueue.dequeue();
                noteQueue.enqueue(noteInfo);
                var noteWidth = calculateNoteWidth(noteInfo.noteLength);
                var noteOffset = calculateNoteOffset(noteInfo.absoluteTime);
                drawNote(noteWidth, noteOffset, pianoNote, activeNoteQueue);
                count++;
            }
        });
    }
}

function isFinished() {

    var allNotesInactive = true;
    activeNoteQueues.forEach((noteQueue) => {
        // if any notes are active then we are not finished
        if (!noteQueue.isEmpty()) {
            allNotesInactive = false;
            return;
        }
    });

    if (!allNotesInactive) {
        return false;
    }

    // if we get to this point all queues are empty
    // which means all notes have been played.
    // we now need to check if all notes are off screen,
    // which is when the animation is "finished"
    var allNotesOffScreen = true;
    allNotes.forEach((note) => {
        if (note.shape.translation.x >= offset - note.width / 2) {
            allNotesOffScreen = false;
        }
    });

    return allNotesOffScreen;
}

var exports = module.exports = {};

exports.pause = function() {
    isPlaying = false;
};

exports.start = function() {
    isPlaying = true;
};

// pre-draws all notes
exports.initialize = function(noteQueuesLocal) {
    noteQueues = noteQueuesLocal;
    drawEntireMidiFile();
};

exports.setExporting = function(exporting) {
    isExporting = exporting;

    // whether we are starting or stopping exporting, we want to reset the
    // animation to its initial state
    drawEntireMidiFile();
    if (isExporting) {
        backgroundImg = document.createElement('img');
        backgroundImg.src = backgroundImgPath;
        isPlaying = true;
    } else {
        isPlaying = false;
    }
};

exports.skipForwardBySeconds = function(secondsToAdd) {
    timePassed += secondsToAdd * 1000; // timePassed is in ms
    two.update();
};

exports.dimensions = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT
};

exports.backgroundImage = () => {
    return backgroundImg;
};

exports.setBackgroundImagePath = (bgImage) => {
    backgroundImgPath = path.relative("", bgImage);
    backgroundImgPath = backgroundImgPath.replace(/\\/g,'/');

    elem.style.backgroundImage = 'url(' + backgroundImgPath + ')';
    elem.style.backgroundSize = CANVAS_WIDTH + 'px ' + CANVAS_HEIGHT + 'px';
    elem.style.backgroundRepeat = 'no-repeat';

    preview.style.backgroundImage = 'url(' + backgroundImgPath + ')';
    preview.style.backgroundSize = PREVIEW_WIDTH + 'px ' + PREVIEW_HEIGHT + 'px';
    preview.style.backgroundRepeat = 'no-repeat';
};

exports.finished = isFinished;
