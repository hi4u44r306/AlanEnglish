import {useState, useEffect} from 'react';
import '../assets/scss/CountdownTimer.css';
import {getRemainingTimeUntilMsTimestamp} from './CountdownTimerUtils';

const defaultRemainingTime = {
    seconds: '00',
    minutes: '00',
    hours: '00',
    days: '00'
}

const CountdownTimer = ({countdownTimestampMs}) => {
    const [remainingTime, setRemainingTime] = useState(defaultRemainingTime);

    useEffect(() => {
        const intervalId = setInterval(() => {
            updateRemainingTime(countdownTimestampMs);
        }, 1000);
        return () => clearInterval(intervalId);
    },[countdownTimestampMs]);

    function updateRemainingTime(countdown) {
        setRemainingTime(getRemainingTimeUntilMsTimestamp(countdown));
    }

    return(
        <div className="countdown-timer">
            <span>結算倒數 : </span>
            <span>{remainingTime.days}</span>
            <span>天</span>
            <span className="two-numbers">{remainingTime.hours}</span>
            <span>小時</span>
            <span className="two-numbers">{remainingTime.minutes}</span>
            <span>分鐘</span>
            {/* <span className="two-numbers">{remainingTime.seconds}</span>
            <span>秒</span> */}
        </div>
    );
}

export default CountdownTimer;