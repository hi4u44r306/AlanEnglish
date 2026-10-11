import {useEffect, useRef, useState} from 'react';

// Memory only. A context change, hidden tab or unmount invalidates pending permission/recording.
export default function useLocalRecording(scope) {
  const resource = useRef({generation: 0, stream: null, recorder: null, url: null, timer: null});
  const [state, setState] = useState({phase: 'idle', url: null, blob: null, message: ''});
  function dispose(update = true) {
    const r = resource.current; r.generation += 1; clearTimeout(r.timer);
    if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop();
    r.stream?.getTracks().forEach(track => track.stop());
    if (r.url) URL.revokeObjectURL(r.url);
    r.stream = null; r.recorder = null; r.url = null; r.timer = null;
    window.speechSynthesis?.cancel();
    if (update) setState({phase: 'idle', url: null, blob: null, message: ''});
  }
  useEffect(() => {
    dispose();
    const hidden = () => {if (document.hidden) dispose();}, hide = () => dispose();
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', hide);
    return () => {document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', hide); dispose(false);};
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps
  async function start() {
    dispose(); const r = resource.current, generation = r.generation;
    setState({phase: 'permission', url: null, message: '請在瀏覽器允許麥克風，也可以取消。'});
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (generation !== r.generation || document.hidden) {stream.getTracks().forEach(track => track.stop()); return;}
      r.stream = stream;
      const recorder = new MediaRecorder(stream), chunks = []; r.recorder = recorder;
      recorder.ondataavailable = event => {if (event.data.size) chunks.push(event.data);};
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop()); clearTimeout(r.timer);
        if (generation !== r.generation) return;
        r.stream = null; r.recorder = null;
        const blob = new Blob(chunks, {type: recorder.mimeType});
        if (!blob.size) {setState({phase: 'idle', url: null, message: '沒有錄到聲音，請再試一次；不扣愛心。'}); return;}
        r.url = URL.createObjectURL(blob);
        setState({phase: 'recorded', url: r.url, blob, message: '錄好了！可以先回聽，再按「送出評分」。'});
      };
      recorder.onerror = () => {if (generation === r.generation) {dispose(); setState({phase: 'idle', url: null, message: '錄音中斷，可以再試一次；不扣愛心。'});}};
      recorder.start(); r.timer = setTimeout(() => {if (generation === r.generation && recorder.state === 'recording') recorder.stop();}, 30000);
      setState({phase: 'recording', url: null, message: '正在錄音，最多30秒；念完按停止。'});
    } catch {
      if (generation !== r.generation) return;
      dispose(); setState({phase: 'idle', url: null, message: '麥克風無法使用或沒有允許，請再試一次；不扣愛心。'});
    }
  }
  function stop() {const r = resource.current; if (r.recorder?.state === 'recording') {setState(s => ({...s, phase: 'stopping'})); r.recorder.stop();}}
  function listen(text) {
    const speech = window.speechSynthesis;
    const voice = speech?.getVoices().find(v => v.localService && /^en[-_]/i.test(v.lang));
    if (!voice) {setState(s => ({...s, message: '此瀏覽器沒有本機英文語音；正式教材示範音檔待串接。不影響跳過或重試。'})); return;}
    speech.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voice; utterance.rate = .85; utterance.lang = voice.lang; speech.speak(utterance);
  }
  return {...state, start, stop, cancel: dispose, listen};
}
