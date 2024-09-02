import React, { useState, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions';
import { saveAs } from 'file-saver';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveSurferRef = useRef(null);
  const chunks = useRef([]);
  const regionRef = useRef(null);

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = event => chunks.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/wav' });
        chunks.current = [];
        setAudioBlob(blob);
        createWaveform(blob);
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    });
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const createWaveform = (blob) => {
    const url = URL.createObjectURL(blob);
    const waveSurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#ddd',
      progressColor: '#aaa',
      cursorColor: '#333',
      barWidth: 2,
      height: 150,
      plugins: [
        RegionsPlugin.create({
          regions: [
            {
              start: 0,
              end: 10,
              color: 'rgba(255, 0, 0, 0.5)',
            },
          ],
          dragSelection: true,
        }),
      ],
    });

    waveSurfer.load(url);
    waveSurferRef.current = waveSurfer;

    waveSurfer.on('region-created', (region) => {
      regionRef.current = region;
    });

    waveSurfer.on('region-updated', (region) => {
      regionRef.current = region;
    });

    waveSurfer.on('finish', () => setIsPlaying(false));
  };

  const playAudio = () => {
    if (!waveSurferRef.current) return;
    if (isPlaying) {
      waveSurferRef.current.pause();
      setIsPlaying(false);
    } else {
      waveSurferRef.current.play();
      setIsPlaying(true);
    }
  };

  const trimAudio = async () => {
    if (!waveSurferRef.current || !regionRef.current) return;
  
    const { start, end } = regionRef.current;
    const sampleRate = waveSurferRef.current.backend.buffer.sampleRate;
    const buffer = waveSurferRef.current.backend.buffer;
  
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const trimmedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      (end - start) * sampleRate,
      sampleRate
    );
  
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channelData = buffer.getChannelData(i);
      trimmedBuffer.copyToChannel(
        channelData.slice(start * sampleRate, end * sampleRate),
        i
      );
    }
  
    const wavBlob = audioBufferToWav(trimmedBuffer);
    const newBlob = new Blob([wavBlob], { type: 'audio/wav' });
  
    // Clear the current waveform and create a new instance
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
    }
  
    const newWaveSurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#ddd',
      progressColor: '#aaa',
      cursorColor: '#333',
      barWidth: 2,
      height: 150,
      plugins: [
        RegionsPlugin.create({
          regions: [
            {
              start: 0,
              end: trimmedBuffer.duration,
              color: 'rgba(255, 0, 0, 0.5)',
            },
          ],
          dragSelection: true,
        }),
      ],
    });
  
    newWaveSurfer.load(URL.createObjectURL(newBlob));
    waveSurferRef.current = newWaveSurfer;
  
    newWaveSurfer.on('region-created', (region) => {
      regionRef.current = region;
    });
  
    newWaveSurfer.on('region-updated', (region) => {
      regionRef.current = region;
    });
  
    newWaveSurfer.on('finish', () => setIsPlaying(false));
  
    setAudioBlob(newBlob);
  };

  const audioBufferToWav = (buffer) => {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2 + 44;
    const view = new DataView(new ArrayBuffer(length));
    const sampleRate = buffer.sampleRate;

    let offset = 0;
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, length - 8, true);
    offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, numOfChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * numOfChannels * 2, true);
    offset += 4;
    view.setUint16(offset, numOfChannels * 2, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString('data');
    view.setUint32(offset, buffer.length * numOfChannels * 2, true);
    offset += 4;

    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7FFF, true);
        offset += 2;
      }
    }

    return view.buffer;
  };

  const deleteAudio = () => {
    if (window.confirm('Are you sure you want to delete the audio?')) {
      if (!waveSurferRef.current) return;

      waveSurferRef.current.destroy();
      waveSurferRef.current = null;

      setAudioBlob(null);
      setIsPlaying(false);
    }
  };

  const downloadAudio = (format) => {
    if (!audioBlob) return;

    const fileName = `audio.${format}`;
    if (format === 'wav') {
      saveAs(audioBlob, fileName);
    }
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Audio Editor</h1>
      <div className="text-center mb-4">
        {!isRecording ? (
          <button
            className={`btn btn-primary btn-lg ${isRecording ? 'recording' : ''}`}
            onClick={startRecording}
            disabled={audioBlob}
          >
            Start Recording
          </button>
        ) : (
          <button
            className="btn btn-danger btn-lg"
            onClick={stopRecording}
            disabled={audioBlob}
          >
            Stop Recording
          </button>
        )}
      </div>
      <div id="waveform" className="mb-4"></div>
      <div className="text-center">
        {audioBlob && (
          <>
            <button
              className="btn btn-success me-2"
              onClick={playAudio}
            >
              {isPlaying ? 'Pause' : 'Play'} Audio
            </button>
            <button
              className="btn btn-warning me-2"
              onClick={trimAudio}
            >
              Trim Audio
            </button>
            <button
              className="btn btn-danger me-2"
              onClick={deleteAudio}
            >
              Delete Audio
            </button>
            <button
              className="btn btn-info"
              onClick={() => downloadAudio('wav')}
            >
              Download WAV
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
