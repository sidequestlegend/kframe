var TYPE_PAD = 'PAD';
var TYPE_STICK = 'STICK';

var ANGLE_RIGHT = 0;
var ANGLE_UP = 90;
var ANGLE_LEFT = 180;
var ANGLE_DOWN = 270;

var RIGHT = 'right';
var UP = 'up';
var LEFT = 'left';
var DOWN = 'down';

var ANGLES = [ANGLE_RIGHT, ANGLE_UP, ANGLE_LEFT, ANGLE_DOWN];
var DIRECTIONS = [RIGHT, UP, LEFT, DOWN];

var EVENTS = {NULL: {START: 'thumbstart', END: 'thumbend'}};
DIRECTIONS.forEach(direction => {
  EVENTS[direction] = {};
  EVENTS[direction].START = 'thumb' + direction + 'start';
  EVENTS[direction].END  = 'thumb' + direction + 'end';
});

// For debug.
var SIZE = 240;

/**
 * Normalize trackpad vs thumbstick controls.
 * `thumbstart`
 * `thumbend`
 * `thumbleftstart`
 * `thumbleftend`
 * `thumbrightstart`
 * `thumbrightend`
 * `thumbupstart`
 * `thumbupend`
 * `thumbdownstart`
 * `thumbdownend`
 */
AFRAME.registerComponent('thumb-controls', {
  dependencies: ['tracked-controls'],

  schema: {
    thresholdAngle: {default: 89.5},
    thresholdPad: {default: 0.05},
    thresholdStick: {default: 0.75}
  },

  init: function () {
    var el = this.el;
    this.onTrackpadDown = this.onTrackpadDown.bind(this)
    this.onTrackpadUp = this.onTrackpadUp.bind(this)

    this.directionStick = '';
    this.directionTrackpad = '';

    // Get thumb type (stick vs pad).
    this.type = TYPE_STICK;
    el.addEventListener('controllerconnected', evt => {
      if (evt.detail.name === 'oculus-touch-controls' ||
          evt.detail.name === 'windows-motion-controls') {
        this.type = TYPE_STICK;
        return;
      }
      this.type = TYPE_PAD;
    });

    this.axis = el.components['tracked-controls'].axis;
  },

  play: function () {
    var el = this.el;
    el.addEventListener('trackpaddown', this.onTrackpadDown);
    el.addEventListener('trackpadup', this.onTrackpadUp);
  },

  pause: function () {
    var el = this.el;
    el.removeEventListener('trackpaddown', this.onTrackpadDown);
    el.removeEventListener('trackpadup', this.onTrackpadUp);
  },

  // For pad.
  onTrackpadDown: function () {
    var direction;
    var el = this.el;
    var i;
    if (this.getDistance() < this.data.thresholdPad) { return; }
    direction = this.getDirection();
    if (!direction) { return; }
    this.directionTrackpad = direction;
    el.emit(EVENTS.NULL.START, null, false);
    el.emit(EVENTS[this.directionTrackpad].START, null, false);
  },

  // For pad.
  onTrackpadUp: function () {
    var el = this.el;
    if (!this.directionTrackpad) { return; }
    el.emit(EVENTS.NULL.END, null, false);
    el.emit(EVENTS[this.directionTrackpad].END, null, false);
    this.directionTrackpad = '';
  },

  // Axis.
  tick: function () {
    var direction;
    var el = this.el;

    if (this.type === TYPE_PAD) { return; }

    // Stick pulled. Store direction and emit start event.
    if (!this.directionStick && this.getDistance() > this.data.thresholdStick) {
      direction = this.getDirection();
      if (!direction) { return; }
      this.directionStick = direction;
      el.emit(EVENTS.NULL.START, null, false);
      el.emit(EVENTS[this.directionStick].START, null, false);
      return;
    }

    // Stick pulled back. Reset direciton and emit end event.
    if (this.directionStick && this.getDistance() < this.data.thresholdStick) {
      el.emit(EVENTS.NULL.END, null, false);
      el.emit(EVENTS[this.directionStick].END, null, false);
      this.directionStick = '';
    }
  },

  /**
   * Distance from center of thumb.
   */
  getDistance: function () {
    var axis = this.axis;
    return Math.sqrt(axis[1] * axis[1] + axis[0] * axis[0]);
  },

  /**
   * Translate angle into direction.
   */
  getDirection: function () {
    var angle;
    var bottomThreshold;
    var i;
    var threshold;
    var topThreshold;
    angle = this.getAngle();
    threshold = this.data.thresholdAngle / 2;
    for (i = 0; i < ANGLES.length; i++) {
      topThreshold = ANGLES[i] + threshold;
      if (topThreshold > 360) { topThreshold = topThreshold - 360; }

      bottomThreshold = ANGLES[i] - threshold;
      if (bottomThreshold < 0) {
        if ((angle >= 360 + bottomThreshold && angle <= 360) ||
            (angle >= 0 && angle <= topThreshold)) {
          return DIRECTIONS[i];
        }
      }

      if (angle >= bottomThreshold && angle <= topThreshold) {
        return DIRECTIONS[i];
      }
    }
  },

  /**
   * Get angle in degrees, with 0 starting on the right going to 360. Like unit circle.
   */
  getAngle: function () {
    var angle;
    var axis = this.axis;
    var flipY;
    flipY = this.type === TYPE_STICK ? -1 : 1;
    angle = Math.atan2(axis[1] * flipY, axis[0]);
    if (angle < 0) { angle = 2 * Math.PI + angle; }
    return THREE.Math.radToDeg(angle);
  }
});

AFRAME.registerComponent('thumb-controls-debug', {
  dependencies: ['tracked-controls'],

  schema: {
    controllerType: {type: 'string'},
    hand: {type: 'string'},
    enabled: {default: false}
  },

  init: function () {
    var isActive;
    var axis;
    var axisMoveEventDetail;
    var canvas;
    var el = this.el;
    var data = this.data;

    if (!data.enabled && !AFRAME.utils.getUrlParameter('debug-thumb')) { return; }
    console.log('%c debug-thumb', 'background: #111; color: red');

    // Stub.
    el.components['tracked-controls'].handleAxes = () => {};

    axis = [0, 0, 0];
    axisMoveEventDetail = {axis: axis};
    el.components['tracked-controls'].axis = axis;

    canvas = this.createCanvas();

    canvas.addEventListener('click', evt => {
      if (this.data.controllerType === 'vive-controls') {
        if (isActive) {
          el.emit('trackpadup');
        } else {
          el.emit('trackpaddown');
        }
      } else {
        if (isActive) {
          axis[0] = 0;
          axis[1] = 0;
          el.emit('axismove', axisMoveEventDetail, false);
        }
      }
      isActive = !isActive;
    });

    canvas.addEventListener('mousemove', evt => {
      var rect;
      if (!isActive) { return; }
      rect = canvas.getBoundingClientRect();
      axis[0] = (evt.clientX - rect.left) / SIZE * 2 - 1;
      axis[1] = (evt.clientY - rect.top) / SIZE * 2 - 1;
      el.emit('axismove', axisMoveEventDetail, false);
    });

    canvas.addEventListener('mouseleave', evt => {
      if (!isActive) { return; }
      axis[0] = 0;
      axis[1] = 0;
      el.emit('axismove', axisMoveEventDetail, false);
    });
  },

  createCanvas: function () {
    var canvas;
    var ctx;
    canvas = document.createElement('canvas');
    canvas.classList.add('debugThumb');
    canvas.height = SIZE;
    canvas.width = SIZE;
    canvas.style.bottom = 0;
    canvas.style.borderRadius = '250px';
    canvas.style.opacity = 0.5;
    canvas.style.position = 'fixed';
    canvas.style.zIndex = 999999999;
    if (this.data.hand === 'left') {
      canvas.style.left = 0;
    } else {
      canvas.style.right = 0;
    }
    ctx = canvas.getContext('2d');
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, SIZE, SIZE);
    document.body.appendChild(canvas);
    return canvas;
  }
});
