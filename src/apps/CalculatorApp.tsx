import { useState, useEffect, useCallback } from 'react';
import { Delete } from 'lucide-react';
import { useWindows } from '../windows/WindowManager';

export default function CalculatorApp() {
  const { state: windowState } = useWindows();
  const isActive = windowState.activeId === 'calculator';

  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(false);
    setError(null);
  }, []);

  const inputDigit = useCallback((digit: string) => {
    if (error) {
      setError(null);
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }

    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  }, [display, waitingForOperand, error]);

  const inputDot = useCallback(() => {
    if (error) {
      setError(null);
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }

    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand, error]);

  const backspace = useCallback(() => {
    if (error) {
      clearAll();
      return;
    }
    if (waitingForOperand) return;

    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }, [display, error, waitingForOperand, clearAll]);

  const performOperation = useCallback((nextOp: string) => {
    const inputValue = parseFloat(display);

    if (error) return;

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operation) {
      const currentValue = prevValue || 0;
      let result = 0;

      switch (operation) {
        case '+':
          result = currentValue + inputValue;
          break;
        case '-':
          result = currentValue - inputValue;
          break;
        case '×':
        case '*':
          result = currentValue * inputValue;
          break;
        case '÷':
        case '/':
          if (inputValue === 0) {
            setError('Cannot divide by zero');
            setDisplay('Error');
            setPrevValue(null);
            setOperation(null);
            return;
          }
          result = currentValue / inputValue;
          break;
        default:
          result = inputValue;
      }

      if (!isFinite(result) || isNaN(result)) {
        setError('Math Error');
        setDisplay('Error');
        setPrevValue(null);
        setOperation(null);
        return;
      }

      // Format clean numbers
      const formatted = String(Math.round(result * 100000000) / 100000000);
      setDisplay(formatted);
      setPrevValue(result);
    }

    setWaitingForOperand(true);
    setOperation(nextOp === '=' ? null : nextOp);
  }, [display, prevValue, operation, error]);

  // Support keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process when Calculator is the active window
      if (!isActive) return;
      // Don't intercept if an input is focused somewhere else
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        inputDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        inputDot();
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        performOperation(e.key);
      } else if (e.key === '*') {
        e.preventDefault();
        performOperation('×');
      } else if (e.key === '/') {
        e.preventDefault();
        performOperation('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        performOperation('=');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, inputDigit, inputDot, performOperation, backspace, clearAll]);

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto p-4 select-none justify-between">
      {/* Display */}
      <div className="bg-[#29332d] text-right rounded-2xl p-4 mb-4 shadow-inner flex flex-col justify-end min-h-[96px] border border-white/10">
        <div className="text-xs text-[#a1aaa1] h-5 truncate tracking-wider font-mono">
          {prevValue !== null && operation ? `${prevValue} ${operation}` : ''}
        </div>
        <div className="text-3xl font-light text-[#e0e5df] truncate tracking-tight font-mono">
          {display}
        </div>
        {error && (
          <div className="text-xs text-red-400 mt-1 truncate">
            {error}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2.5 flex-1">
        <button
          onClick={clearAll}
          className="bg-red-500/20 text-red-600 dark:text-red-400 font-medium py-3 rounded-xl hover:bg-red-500/30 active:scale-95 transition min-h-[48px] text-lg"
          aria-label="Clear All"
        >
          C
        </button>
        <button
          onClick={backspace}
          className="bg-black/5 dark:bg-white/10 font-medium py-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition min-h-[48px] flex items-center justify-center"
          aria-label="Delete"
        >
          <Delete size={20} />
        </button>
        <button
          onClick={() => {
            if (display !== '0' && !error) {
              const val = parseFloat(display);
              setDisplay(String(-val));
            }
          }}
          className="bg-black/5 dark:bg-white/10 font-medium py-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition min-h-[48px] text-lg"
        >
          ±
        </button>
        <button
          onClick={() => performOperation('÷')}
          className={`py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl ${
            operation === '÷' ? 'bg-[#e29352] text-white' : 'bg-[#e29352]/20 text-[#c7722d] dark:text-[#f4a86b] hover:bg-[#e29352]/30'
          }`}
        >
          ÷
        </button>

        <button onClick={() => inputDigit('7')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">7</button>
        <button onClick={() => inputDigit('8')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">8</button>
        <button onClick={() => inputDigit('9')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">9</button>
        <button
          onClick={() => performOperation('×')}
          className={`py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl ${
            operation === '×' ? 'bg-[#e29352] text-white' : 'bg-[#e29352]/20 text-[#c7722d] dark:text-[#f4a86b] hover:bg-[#e29352]/30'
          }`}
        >
          ×
        </button>

        <button onClick={() => inputDigit('4')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">4</button>
        <button onClick={() => inputDigit('5')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">5</button>
        <button onClick={() => inputDigit('6')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">6</button>
        <button
          onClick={() => performOperation('-')}
          className={`py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl ${
            operation === '-' ? 'bg-[#e29352] text-white' : 'bg-[#e29352]/20 text-[#c7722d] dark:text-[#f4a86b] hover:bg-[#e29352]/30'
          }`}
        >
          -
        </button>

        <button onClick={() => inputDigit('1')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">1</button>
        <button onClick={() => inputDigit('2')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">2</button>
        <button onClick={() => inputDigit('3')} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">3</button>
        <button
          onClick={() => performOperation('+')}
          className={`py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl ${
            operation === '+' ? 'bg-[#e29352] text-white' : 'bg-[#e29352]/20 text-[#c7722d] dark:text-[#f4a86b] hover:bg-[#e29352]/30'
          }`}
        >
          +
        </button>

        <button onClick={() => inputDigit('0')} className="col-span-2 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl text-left pl-6">0</button>
        <button onClick={inputDot} className="bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 py-3 rounded-xl font-medium active:scale-95 transition min-h-[48px] text-xl">.</button>
        <button
          onClick={() => performOperation('=')}
          className="bg-[#c7722d] hover:bg-[#b05f1f] text-white font-medium py-3 rounded-xl active:scale-95 transition min-h-[48px] text-xl shadow"
        >
          =
        </button>
      </div>
    </div>
  );
}
