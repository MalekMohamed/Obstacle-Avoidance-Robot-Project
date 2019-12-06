'use strict'
const Gpio = require('pigpio').Gpio;
const ADXL345 = require('adxl345-sensor');
/* Motors Configuration */
const motorA1 = new Gpio(22, {mode: Gpio.OUTPUT});
const motorA2 = new Gpio(27, {mode: Gpio.OUTPUT});
const motorB1 = new Gpio(17, {mode: Gpio.OUTPUT});
const motorB2 = new Gpio(18, {mode: Gpio.OUTPUT});
const motorSpeed = new Gpio(12, {mode: Gpio.OUTPUT}); // PWM PIN
/* Sensors Configuration */
const SensorRight = new Gpio(23, {mode: Gpio.INPUT, alert: true});
const trigerPinRight = new Gpio(24, {mode: Gpio.OUTPUT});
const SensorMiddle = new Gpio(20, {mode: Gpio.INPUT, alert: true});
const trigerPinMiddle = new Gpio(21, {mode: Gpio.OUTPUT});
const SensorLeft = new Gpio(5, {mode: Gpio.INPUT, alert: true});
const trigerPinLeft = new Gpio(6, {mode: Gpio.OUTPUT});
const adxl345 = new ADXL345(); // defaults to i2cBusNo 1, i2cAddress 0x53
/* Constant Values */
const MICROSECDONDS_PER_CM = 1e6 / 34321;
const maxRange = 10;
let acceleration = 0;
var sensors = {Right: 0, Left: 0, Middle: 0};
/* Initializing */
trigerPinRight.digitalWrite(0);
trigerPinMiddle.digitalWrite(0);
trigerPinLeft.digitalWrite(0);
/* Listen Function from pigpio lib */
const watch = (Sensor, position) => {
    let startTick;
    console.log("Connecting to " + position + " sensor");
    Sensor.on('alert', (level, tick) => {
        if (level == 1) {
            startTick = tick;
        } else {
            const endTick = tick;
            const diff = (endTick >> 0) - (startTick >> 0); // Unsigned 32 bit arithmetic
            var echoValue = Math.floor(diff / 2 / MICROSECDONDS_PER_CM);
            loop(echoValue, position);
        }
    });
};
const getAcceleration = () => {
    adxl345.getAcceleration(true) // true for g-force units, else false for m/s²
        .then((acceleration) => {
            let roll = Math.acos(acceleration.y/Math.sqrt(acceleration.z*acceleration.z+acceleration.y*acceleration.y)) * 180/3.14;
            let pitch = Math.acos(acceleration.x/Math.sqrt(acceleration.z*acceleration.z+acceleration.x*acceleration.x)) * 180/3.14;
            roll =  Math.floor(numberMapping(roll , 60 , 120 , -90 , 90));
            pitch =  Math.floor(numberMapping(pitch , 66 ,128 , -80 , 80)) - 10;
            loop(roll, 'roll');
            loop(pitch, 'pitch');
        })
        .catch((err) => {
            console.log(`ADXL345 read error: ${err}`);
        });
};

// Initialize the ADXL345 accelerometer
//
adxl345.init()
    .then(() => {
        console.log('ADXL345 initialization succeeded');
        getAcceleration();
    })
    .catch((err) => console.error(`ADXL345 initialization failed: ${err} `));
/* Listen to Sensors */
watch(SensorMiddle, 'Middle');
watch(SensorLeft, 'Left');
watch(SensorRight, 'Right');

/* Void Loop */
setInterval(() => {
    getAcceleration();
    for (var Position in sensors) {
        console.log(Position + " Sensor: " + sensors[Position]);
    }
    if(sensors.pitch <= 15  && sensors.roll <= 15) {
        console.log('Spinning');
        Move('left');
    } else {
        Move('forward');
        if (sensors.Right < maxRange) {
            Move('left');
        }
        if (sensors.Left < maxRange) {
            Move('right');
        }
        if (sensors.Middle < maxRange) {
            if (sensors.Left > sensors.Right) {
                Move('left');
            } else if (sensors.Right > sensors.Left) {
                Move('right');
            } else if (sensors.Right < maxRange && sensors.Left < maxRange) {
                Move('backward');
            }
        }
    }
    trigerPinRight.trigger(10, 1); // Set trigger high for 10 microseconds
    trigerPinLeft.trigger(10, 1);
    trigerPinMiddle.trigger(10, 1);

}, 1000);

/* Car Control */
function Move(direction) {
    /* setInterval(() => {
         motorSpeed.pwmWrite(acceleration);
         acceleration += 5;
         if (acceleration > 255) {
             acceleration = 0;
         }
     }, 10);
     if (direction == 'forward') {
         motorA1.digitalWrite(HIGH);
         motorA2.digitalWrite(LOW);
         motorB1.digitalWrite(HIGH);
         motorB2.digitalWrite(LOW);
     } else if (direction == 'backward') {
         motorA1.digitalWrite(LOW);
         motorA2.digitalWrite(HIGH);
         motorB1.digitalWrite(LOW);
         motorB2.digitalWrite(HIGH);
     } else if (direction == 'left') {
         motorA1.digitalWrite(LOW);
         motorA2.digitalWrite(HIGH);
         motorB1.digitalWrite(HIGH);
         motorB2.digitalWrite(LOW);
     } else if (direction == 'right') {
         motorA1.digitalWrite(HIGH);
         motorA2.digitalWrite(LOW);
         motorB1.digitalWrite(LOW);
         motorB2.digitalWrite(HIGH);
     }*/
}
function numberMapping(value, low1, high1, low2, high2) {
    return (value - low1) * (high2 - low2) / (high1 - low1) + low2;
}
/* Set Sensors values to empty Object */
function loop(distance, position) {
    if (distance <= 100) {
        switch (position) {
            case 'Right':
                sensors.Right = distance;
                break;
            case 'Left':
                sensors.Left = distance;
                break;
            case 'Middle':
                sensors.Middle = distance;
                break;

        }
    }
    if (position == 'roll') {
        sensors.roll = distance;
    }
    else if (position == 'pitch') {
        sensors.pitch = distance;
    }
    return sensors;

}
