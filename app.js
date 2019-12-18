'use strict'
const Gpio = require('pigpio').Gpio;
const process = require('process');
const ADXL345 = require('adxl345-sensor');
/* Motors Configuration */
const motorA1 = new Gpio(22, {mode: Gpio.OUTPUT});
const motorA2 = new Gpio(27, {mode: Gpio.OUTPUT});
const motorB1 = new Gpio(18, {mode: Gpio.OUTPUT});
const motorB2 = new Gpio(17, {mode: Gpio.OUTPUT});
const motorSpeed = new Gpio(12, {mode: Gpio.OUTPUT}); // PWM PIN
/* Sensors Configuration */
const SensorRight = new Gpio(20, {mode: Gpio.INPUT, alert: true});
const trigerPinRight = new Gpio(21, {mode: Gpio.OUTPUT});
const SensorMiddle = new Gpio(5, {mode: Gpio.INPUT, alert: true});
const trigerPinMiddle = new Gpio(6, {mode: Gpio.OUTPUT});
const SensorLeft = new Gpio(23, {mode: Gpio.INPUT, alert: true});
const trigerPinLeft = new Gpio(24, {mode: Gpio.OUTPUT});
const adxl345 = new ADXL345(); // defaults to i2cBusNo 1, i2cAddress 0x53
/* Constant Values */
const MICROSECDONDS_PER_CM = 1e6 / 34321;
const maxRange = 27;
let acceleration = 75;
let sensors = {Right: 0, Left: 0, Middle: 0};
/* Initializing */
trigerPinRight.digitalWrite(0);
trigerPinMiddle.digitalWrite(0);
trigerPinLeft.digitalWrite(0);
let Flag = true;
let FlagForward = true;
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
            let roll = Math.acos(acceleration.y / Math.sqrt(acceleration.z * acceleration.z + acceleration.y * acceleration.y)) * 180 / 3.14;
            let pitch = Math.acos(acceleration.x / Math.sqrt(acceleration.z * acceleration.z + acceleration.x * acceleration.x)) * 180 / 3.14;
            roll = Math.floor(numberMapping(roll, 60, 120, -90, 90));
            pitch = Math.floor(numberMapping(pitch, 66, 128, -80, 80)) - 10;

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

    if (Flag == true) {
        Move('forward');
    }
    setTimeout(function () {
        Flag = false;
    }, 1500);
    process.stdout.write('\x1Bc');
    getAcceleration();
    for (var Position in sensors) {
        console.log(Position + " Sensor: " + sensors[Position]);
    }
    if (sensors.roll >= 10 || sensors.roll <= -10) {
        console.log('Spinning');
        if (sensors.Left > maxRange) {
            Move('right');
            FlagForward = true;
        } else if (sensors.Right > maxRange) {
            Move('left');
            FlagForward = true;
        } else {
            Move('forward');
        }
    } else {
        if (FlagForward == true && sensors.Right >= maxRange && sensors.Left >= maxRange && sensors.Middle >= maxRange) {
            Move('forward');
        } else if (sensors.Middle < maxRange) {
            if (sensors.Middle < maxRange && sensors.Right < maxRange && sensors.Left < maxRange) {
                Move('backward');
                FlagForward = false;
                setTimeout(function () {
                    if (sensors.Left > maxRange) {
                        Move('right');
                        FlagForward = true;
                    } else if (sensors.Right > maxRange) {
                        Move('left');
                        FlagForward = true;
                    }
                }, 200);
            } else if (sensors.Left > sensors.Right) {
                Move('left');
                FlagForward = true;
            } else if (sensors.Right > sensors.Left) {
                Move('right');
                FlagForward = true;
            }
        } else {
            if (sensors.Left > maxRange) {
                Move('right');
                FlagForward = true;
            } else if (sensors.Right > maxRange) {
                Move('left');
                FlagForward = true;
            }
        }
    }
    trigerPinRight.trigger(10, 1); // Set trigger 1 for 10 microseconds
    trigerPinLeft.trigger(10, 1);
    trigerPinMiddle.trigger(10, 1);

}, 100);

/* Car Control */
function Move(direction) {
    motorSpeed.pwmWrite(acceleration);
    if (direction == 'forward') {
        motorA1.digitalWrite(1);
        motorA2.digitalWrite(0);
        motorB1.digitalWrite(1);
        motorB2.digitalWrite(0);
    } else if (direction == 'backward') {
        motorA1.digitalWrite(0);
        motorA2.digitalWrite(1);
        motorB1.digitalWrite(0);
        motorB2.digitalWrite(1);
    } else if (direction == 'left') {
        motorA1.digitalWrite(0);
        motorA2.digitalWrite(1);
        motorB1.digitalWrite(1);
        motorB2.digitalWrite(0);
    } else if (direction == 'right') {
        motorA1.digitalWrite(1);
        motorA2.digitalWrite(0);
        motorB1.digitalWrite(0);
        motorB2.digitalWrite(1);
    }
    console.log('Current: ' + direction);
}

function numberMapping(value, low1, high1, low2, high2) {
    return (value - low1) * (high2 - low2) / (high1 - low1) + low2;
}

/* Set Sensors values to empty Object */
function loop(distance, position) {
    if (distance <= 300 && distance > 0) {
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
    } else if (position == 'pitch') {
        sensors.pitch = distance;
    }
    return sensors;

}


process.on('SIGINT', () => {
    motorA1.digitalWrite(0);
    motorA2.digitalWrite(0);
    motorB1.digitalWrite(0);
    motorB2.digitalWrite(0);
    trigerPinRight.digitalWrite(0);
    trigerPinMiddle.digitalWrite(0);
    trigerPinLeft.digitalWrite(0);
    motorSpeed.digitalWrite(0);
    console.log('\n Program ended \n');
    process.exit();
});
