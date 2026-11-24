import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ShieldAlert, Sparkles, XCircle } from 'lucide-react';

interface BiometricModalProps {
  workerId: string;
  workerName: string;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BiometricModal: React.FC<BiometricModalProps> = ({
  workerId,
  workerName,
  token,
  onSuccess,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function initCam() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 480, height: 360 },
            audio: false,
          });
          setStream(activeStream);
          if (videoRef.current) {
            videoRef.current.srcObject = activeStream;
          }
        } else {
          setCameraError('Navegador sin soporte de cámara web. Puede usar el modo de prueba biométrica.');
        }
      } catch {
        setCameraError(
          'Permiso de cámara denegado o sin cámara física conectada. Use el simulador biométrico inferior para pruebas.'
        );
      }
    }
    initCam();
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  const runVerification = async (simulatedEvent?: 'VERIFIED_OK' | 'IDENTITY_MISMATCH' | 'NO_FACE_DETECTED') => {
    setVerifying(true);
    setResultMsg(null);
    try {
      let imageBase64: string | null = null;
      if (!simulatedEvent && videoRef.current && canvasRef.current && stream) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 320;
          canvasRef.current.height = 240;
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          imageBase64 = canvasRef.current.toDataURL('image/jpeg', 0.8);
        }
      }

      const res = await fetch('/api/v1/biometrics/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId,
          sessionType: 'LOGIN',
          imageBase64,
          simulatedEvent: simulatedEvent || (imageBase64 ? undefined : 'VERIFIED_OK'),
          clientFaceCount: simulatedEvent === 'NO_FACE_DETECTED' ? 0 : 1,
        }),
      }).then((r) => r.json());

      if (res.success && res.data.verified) {
        setResultMsg({ ok: true, text: res.data.message });
        setTimeout(() => {
          stopCamera();
          onSuccess();
        }, 900);
      } else {
        setResultMsg({
          ok: false,
          text: res.data?.message || res.error || 'Verificación biométrica rechazada. Intente nuevamente.',
        });
      }
    } catch (err: any) {
      setResultMsg({ ok: false, text: `Error de red: ${err.message}` });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-[#222d32] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-black">Verificación Biométrica Facial con IA</h3>
              <p className="text-[11px] text-slate-300">Prueba de vida y coincidencia con DNI · {workerName}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center border-2 border-slate-700">
            {!cameraError ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-4 text-center text-slate-300 space-y-2">
                <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
                <p>{cameraError}</p>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-emerald-400/50 m-6 rounded-full" />
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {resultMsg && (
            <div
              className={`p-3 rounded-lg border font-semibold flex items-start gap-2 ${
                resultMsg.ok
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {resultMsg.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{resultMsg.text}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={verifying}
              onClick={() => runVerification()}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {verifying ? 'Validando rostro con Gemini Vision...' : 'Capturar y Verificar Identidad'}
            </button>
          </div>

          {/* Controles rápidos de simulación para entornos sin webcam */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5">
            <span className="block text-[10px] font-bold uppercase text-slate-400">
              Simulador de Pruebas Biométricas (Sin Webcam Física):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={verifying}
                onClick={() => runVerification('VERIFIED_OK')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[11px] cursor-pointer"
              >
                ✅ Simular Rostro Válido
              </button>
              <button
                type="button"
                disabled={verifying}
                onClick={() => runVerification('IDENTITY_MISMATCH')}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[11px] cursor-pointer"
              >
                ⛔ Simular Suplantación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
