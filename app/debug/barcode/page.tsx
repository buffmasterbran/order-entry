'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  type: string;
  event: string;
  value: string;
  length: number;
  charCodes: number[];
  keyCode?: number;
  key?: string;
  details: any;
}

export default function BarcodeDebugPage() {
  const [inputValue, setInputValue] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoFocus, setAutoFocus] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: string, event: string, value: string, details: any = {}) => {
    const timestamp = new Date().toISOString();
    const charCodes = Array.from(value).map((char) => char.charCodeAt(0));
    const entry: LogEntry = {
      timestamp,
      type,
      event,
      value,
      length: value.length,
      charCodes,
      keyCode: details.keyCode,
      key: details.key,
      details: JSON.stringify(details, null, 2),
    };

    console.log(`[${type}] ${event}:`, {
      value,
      length: value.length,
      charCodes,
      ...details,
    });

    setLogs((prev) => [...prev, entry]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    const nativeEvent = e.nativeEvent as InputEvent;
    addLog('INPUT', 'onChange', value, {
      inputType: nativeEvent.inputType,
      data: nativeEvent.data,
      dataTransfer: (nativeEvent as any).dataTransfer,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    addLog('KEYDOWN', e.key, inputValue, {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: (e.nativeEvent as any).which,
      charCode: (e.nativeEvent as any).charCode,
      repeat: e.repeat,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });

    // If Enter or Tab is pressed, log it as a scan completion
    // Many barcode scanners send Tab or Enter at the end
    if (e.key === 'Enter' || e.key === 'Tab') {
      addLog('SCAN_COMPLETE', `${e.key.toUpperCase()}_PRESSED`, inputValue, {
        message: `Barcode scan completed (${e.key} key pressed)`,
        finalValue: inputValue,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    addLog('KEYPRESS', e.key, inputValue, {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: (e.nativeEvent as any).which,
      charCode: (e.nativeEvent as any).charCode,
      char: String.fromCharCode((e.nativeEvent as any).charCode || 0),
    });
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    addLog('KEYUP', e.key, inputValue, {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
    });
  };

  const handleFocus = () => {
    addLog('FOCUS', 'input focused', inputValue, {});
  };

  const handleBlur = () => {
    addLog('BLUR', 'input blurred', inputValue, {});
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    addLog('PASTE', 'paste event', pastedText, {
      clipboardData: pastedText,
      pastedLength: pastedText.length,
    });
  };

  const handleCompositionStart = (e: React.CompositionEvent<HTMLInputElement>) => {
    addLog('COMPOSITION', 'composition start', inputValue, { data: e.data });
  };

  const handleCompositionUpdate = (e: React.CompositionEvent<HTMLInputElement>) => {
    addLog('COMPOSITION', 'composition update', inputValue, { data: e.data });
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    addLog('COMPOSITION', 'composition end', e.data, { data: e.data });
  };

  const clearLogs = () => {
    setLogs([]);
    console.clear();
  };

  const clearInput = () => {
    setInputValue('');
    addLog('MANUAL', 'input cleared', '', {});
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Barcode Scanner Debug Page</h1>
        <p className="text-gray-600 mb-6">
          This page captures all input events from your barcode scanner. Check the browser console
          and the logs below for detailed information.
        </p>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-lg font-semibold">Barcode Input:</label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onKeyPress={handleKeyPress}
              onKeyUp={handleKeyUp}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPaste={handlePaste}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Scan barcode here..."
              className="flex-1 px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-mono"
              autoFocus={autoFocus}
            />
            <div className="flex gap-2">
              <button
                onClick={clearInput}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
              >
                Clear Input
              </button>
              <button
                onClick={() => {
                  setAutoFocus(!autoFocus);
                  if (!autoFocus && inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
                className={`px-4 py-2 rounded-lg ${
                  autoFocus
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {autoFocus ? 'Auto-Focus ON' : 'Auto-Focus OFF'}
              </button>
            </div>
          </div>

          {/* Current Value Display */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Current Value:</strong>{' '}
                <span className="font-mono text-lg">{inputValue || '(empty)'}</span>
              </div>
              <div>
                <strong>Length:</strong> <span className="font-mono">{inputValue.length}</span>
              </div>
              <div>
                <strong>Character Codes:</strong>{' '}
                <span className="font-mono">
                  {inputValue
                    ? Array.from(inputValue)
                        .map((c) => c.charCodeAt(0))
                        .join(', ')
                    : 'N/A'}
                </span>
              </div>
              <div>
                <strong>Last Event:</strong>{' '}
                <span className="font-mono">
                  {logs.length > 0 ? `${logs[logs.length - 1].type} - ${logs[logs.length - 1].event}` : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Clear Logs
          </button>
          <div className="px-4 py-2 bg-blue-100 rounded-lg">
            <strong>Total Events Logged:</strong> {logs.length}
          </div>
        </div>

        {/* Logs Display */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Event Logs</h2>
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {logs.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">
                No events logged yet. Start scanning or typing to see events here.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left border">Time</th>
                    <th className="px-2 py-2 text-left border">Type</th>
                    <th className="px-2 py-2 text-left border">Event</th>
                    <th className="px-2 py-2 text-left border">Value</th>
                    <th className="px-2 py-2 text-left border">Length</th>
                    <th className="px-2 py-2 text-left border">Char Codes</th>
                    <th className="px-2 py-2 text-left border">Key</th>
                    <th className="px-2 py-2 text-left border">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr
                      key={index}
                      className={`border-b hover:bg-gray-50 ${
                        log.type === 'SCAN_COMPLETE' ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="px-2 py-1 border font-mono text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1 border">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            log.type === 'INPUT'
                              ? 'bg-blue-100 text-blue-800'
                              : log.type === 'KEYDOWN'
                              ? 'bg-green-100 text-green-800'
                              : log.type === 'KEYPRESS'
                              ? 'bg-purple-100 text-purple-800'
                              : log.type === 'KEYUP'
                              ? 'bg-orange-100 text-orange-800'
                              : log.type === 'SCAN_COMPLETE'
                              ? 'bg-yellow-200 text-yellow-900 font-bold'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td className="px-2 py-1 border font-mono">{log.event}</td>
                      <td className="px-2 py-1 border font-mono max-w-xs truncate">
                        {log.value || '(empty)'}
                      </td>
                      <td className="px-2 py-1 border text-center">{log.length}</td>
                      <td className="px-2 py-1 border font-mono text-xs max-w-xs truncate">
                        {log.charCodes.join(', ')}
                      </td>
                      <td className="px-2 py-1 border font-mono">
                        {log.key ? `${log.key} (${log.keyCode || 'N/A'})` : 'N/A'}
                      </td>
                      <td className="px-2 py-1 border">
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:underline">Show</summary>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded max-h-32 overflow-auto">
                            {log.details}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div ref={logsEndRef} />
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Open the browser console (F12) to see detailed logs</li>
            <li>Scan a barcode or type into the input field</li>
            <li>Watch the events appear in the log table below</li>
            <li>
              Look for <strong>SCAN_COMPLETE</strong> events (highlighted in yellow) when Enter is
              pressed
            </li>
            <li>Check character codes to see if there are any hidden characters or line breaks</li>
            <li>The &quot;Current Value&quot; section shows what the input currently contains</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

