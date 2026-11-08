import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Shield,
  Mic,
  Camera,
  Bell,
  Layers,
  BatteryCharging,
  Settings,
  Sparkles,
  Phone,
  Contact,
  MapPin,
  FolderOpen,
  CalendarDays,
  Bluetooth,
  MessageSquare,
  Activity,
} from 'lucide-react';

interface PermissionsScreenProps {
  onBack: () => void;
}

export const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ onBack }) => {
  const [permissions, setPermissions] = useState({
    accessibility: false,
    microphone: false,
    camera: false,
    notifications: false,
    overlay: false,
    battery: false,
  });

  useEffect(() => {
    // Check real browser permissions if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((res) => {
        setPermissions((p) => ({ ...p, microphone: res.state === 'granted' }));
      }).catch(() => {});

      navigator.permissions.query({ name: 'camera' as PermissionName }).then((res) => {
        setPermissions((p) => ({ ...p, camera: res.state === 'granted' }));
      }).catch(() => {});
    }
  }, []);

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, microphone: true }));
    } catch {
      alert('Microphone permission denied or blocked in browser settings.');
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissions((p) => ({ ...p, camera: true }));
    } catch {
      alert('Camera permission denied or blocked in browser settings.');
    }
  };

  const explainNativePermission = (name: string) => {
    alert(`${name} must be enabled through Android's permission dialog or Settings in the installed Android app. This web screen cannot grant native Android permissions, and not every permission is needed for every feature.`);
  };

  const items = [
    {
      id: 'accessibility',
      name: 'Accessibility Service',
      why: 'Phone control: apps kholna, screen padhna, tap/type/scroll',
      ok: permissions.accessibility,
      action: () => explainNativePermission('Accessibility Service'),
      icon: Shield,
    },
    {
      id: 'microphone',
      name: 'Microphone',
      why: 'Voice conversation + background listening',
      ok: permissions.microphone,
      action: requestMicrophone,
      icon: Mic,
    },
    {
      id: 'camera',
      name: 'Camera Vision',
      why: 'Camera se photo dikhana aur visual reasoning karna',
      ok: permissions.camera,
      action: requestCamera,
      icon: Camera,
    },
    {
      id: 'notifications',
      name: 'Notifications',
      why: 'Background listening notification & system status alerts',
      ok: permissions.notifications,
      action: () => explainNativePermission('Notifications'),
      icon: Bell,
    },
    {
      id: 'overlay',
      name: 'Display over other apps',
      why: 'Floating Jarvis Arc Reactor HUD overlay',
      ok: permissions.overlay,
      action: () => explainNativePermission('Display over other apps'),
      icon: Layers,
    },
    {
      id: 'battery',
      name: 'Battery optimization',
      why: 'Background me service band na ho (may help background reliability; Android may still limit background work)',
      ok: permissions.battery,
      action: () => explainNativePermission('Battery optimization'),
      icon: BatteryCharging,
    },
    {
      id: 'app_info',
      name: 'App info (all settings)',
      why: 'Android settings me app ki saari security aur memory permissions',
      ok: false,
      action: () => explainNativePermission('App information and system permissions'),
      icon: Settings,
    },
    {
      id: 'phone', name: 'Phone / Call access', why: 'Call contacts only after user authorization; Android permission required', ok: false, action: () => explainNativePermission('Phone / Call access'), icon: Phone,
    },
    { id: 'contacts', name: 'Contacts', why: 'Find a contact for a call/message; ask before consequential actions', ok: false, action: () => explainNativePermission('Contacts'), icon: Contact },
    { id: 'sms', name: 'SMS / Messaging', why: 'Message-related features where Android and app rules allow', ok: false, action: () => explainNativePermission('SMS / Messaging'), icon: MessageSquare },
    { id: 'location', name: 'Location', why: 'Location-based features only when needed', ok: false, action: () => explainNativePermission('Location'), icon: MapPin },
    { id: 'files', name: 'Photos / Files', why: 'Choose files and images using Android file picker', ok: false, action: () => explainNativePermission('Photos / Files'), icon: FolderOpen },
    { id: 'calendar', name: 'Calendar / Reminders', why: 'Schedule reminders where supported', ok: false, action: () => explainNativePermission('Calendar / Reminders'), icon: CalendarDays },
    { id: 'nearby', name: 'Nearby devices / Bluetooth', why: 'Optional device connectivity; Android may restrict access', ok: false, action: () => explainNativePermission('Nearby devices / Bluetooth'), icon: Bluetooth },
    { id: 'usage', name: 'Usage access', why: 'Optional app-usage information; special access may be required', ok: false, action: () => explainNativePermission('Usage access'), icon: Activity },
  ];

  return (
    <div className="w-full min-h-screen bg-[#020817] text-white p-6 md:p-8 flex flex-col max-w-2xl mx-auto">
      {/* Top Bar matching Page composable */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#1E5BFF]/30">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Permissions</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30">
              Setup
            </span>
          </h2>
          <p className="text-xs text-[#9FB4D9]">
            Permission checklist — Android must grant each permission separately
          </p>
        </div>
      </div>

      {/* Permission Cards */}
      <div className="space-y-3 mt-6 flex-1 overflow-y-auto">
        {items.map((it) => (
          <div
            key={it.id}
            className="p-4 bg-[#0A1A3A] rounded-2xl border border-[#1E5BFF]/30 hover:border-[#22D3FF]/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#020817] border border-[#1E5BFF]/40 text-[#22D3FF]">
                <it.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{it.name}</span>
                  {it.ok && <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />}
                </h3>
                <p className="text-xs text-[#9FB4D9] mt-0.5 leading-relaxed">
                  {it.why}
                </p>
              </div>
            </div>

            <div className="flex items-center self-end md:self-center">
              {it.ok ? (
                <span className="text-xs font-semibold text-[#4ADE80] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/20">
                  <span>✓ Granted</span>
                </span>
              ) : (
                <button
                  onClick={it.action}
                  className="px-4 py-2 bg-[#22D3FF] text-[#020817] rounded-xl text-xs font-bold hover:bg-cyan-300 transition-colors shadow-[0_0_12px_rgba(34,211,255,0.3)] cursor-pointer"
                >
                  Allow / Configure
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
