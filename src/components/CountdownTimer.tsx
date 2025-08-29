import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        if (onComplete) {
          onComplete();
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      
      // Check if countdown is complete
      if (Object.values(newTimeLeft).every(v => v === 0)) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  const formatNumber = (num: number): string => num.toString().padStart(2, '0');

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mt-2">
      <div className="flex items-center space-x-2 text-yellow-800">
        <Clock className="h-4 w-4" />
        <span className="font-medium text-sm">Tiempo restante:</span>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        <div className="text-center">
          <div className="bg-white rounded-md p-1 shadow-sm">
            <span className="text-base font-bold text-yellow-800">{timeLeft.days}</span>
          </div>
          <span className="text-[10px] text-yellow-600 mt-1 block">Días</span>
        </div>
        <div className="text-center">
          <div className="bg-white rounded-md p-1 shadow-sm">
            <span className="text-base font-bold text-yellow-800">{formatNumber(timeLeft.hours)}</span>
          </div>
          <span className="text-[10px] text-yellow-600 mt-1 block">Horas</span>
        </div>
        <div className="text-center">
          <div className="bg-white rounded-md p-1 shadow-sm">
            <span className="text-base font-bold text-yellow-800">{formatNumber(timeLeft.minutes)}</span>
          </div>
          <span className="text-[10px] text-yellow-600 mt-1 block">Minutos</span>
        </div>
        <div className="text-center">
          <div className="bg-white rounded-md p-1 shadow-sm">
            <span className="text-base font-bold text-yellow-800">{formatNumber(timeLeft.seconds)}</span>
          </div>
          <span className="text-[10px] text-yellow-600 mt-1 block">Segundos</span>
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;