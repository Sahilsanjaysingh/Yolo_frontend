import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Save, RotateCw } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";
import axios from "axios";
import emailjs from "@emailjs/browser";

type ObjectToggle = {
  id: string;
  label: string;
  enabled: boolean;
  count?: number;
};

const DEFAULT_OBJECTS: ObjectToggle[] = [
  { id: "oxygen", label: "OxygenTank", enabled: true, count: 0 },
  { id: "nitrogen", label: "NitrogenTank", enabled: true, count: 0 },
  { id: "firstaid", label: "FirstAidBox", enabled: true, count: 0 },
  { id: "firealarm", label: "FireAlarm", enabled: true, count: 0 },
  { id: "safetyswitch", label: "SafetySwitchPanel", enabled: true, count: 0 },
  { id: "emergencyphone", label: "EmergencyPhone", enabled: true, count: 0 },
  { id: "extinguisher", label: "FireExtinguisher", enabled: true, count: 0 },
];

const STORAGE_KEY = "bnb_settings_v1";

export default function Settings() {
  const [confidence, setConfidence] = useState<number>(0.5);
  const [maxObjects, setMaxObjects] = useState<number>(10);
  const [notifyEmail, setNotifyEmail] = useState<string>("");
  const [objects, setObjects] = useState<ObjectToggle[]>(DEFAULT_OBJECTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ EmailJS credentials
  const EMAIL_SERVICE_ID = "service_mlxw1uq";
  const EMAIL_TEMPLATE_ID = "template_xld1hu8";
  const EMAIL_PUBLIC_KEY = "YxepMKNqIjO6nYvqd";

  const [emailMessage, setEmailMessage] = useState<any>({
    name: "",
    email: "",
    text: "",
    file: null,
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  const apiBase = useMemo(
    () => (import.meta.env.VITE_API_URL as string) || "http://localhost:4000",
    []
  );

  useEffect(() => {
    emailjs.init(EMAIL_PUBLIC_KEY);
  }, []);

  // -------------------- Load saved settings --------------------
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${apiBase}/api/settings`);
        if (!mounted) return;
        const data = res.data || {};
        if (typeof data.detectionThreshold === "number")
          setConfidence(data.detectionThreshold);
        if (typeof data.maxObjects === "number") setMaxObjects(data.maxObjects);
        if (typeof data.notifyEmail === "string")
          setNotifyEmail(data.notifyEmail || "");
        if (Array.isArray(data.objects)) setObjects(data.objects);
        if (data.objectCounts && typeof data.objectCounts === "object") {
          setObjects((prev) =>
            prev.map((o) => ({
              ...o,
              count: data.objectCounts[o.label] || o.count || 0,
            }))
          );
        }
      } catch {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.detectionThreshold != null)
              setConfidence(parsed.detectionThreshold);
            if (parsed.maxObjects != null) setMaxObjects(parsed.maxObjects);
            if (parsed.notifyEmail != null) setNotifyEmail(parsed.notifyEmail);
            if (Array.isArray(parsed.objects)) setObjects(parsed.objects);
          }
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [apiBase]);

  // -------------------- Helpers --------------------
  const persistLocal = () => {
    try {
      const payload = {
        detectionThreshold: confidence,
        maxObjects,
        notifyEmail,
        objects,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, enabled } : o))
    );
  };

  const resetDefaults = () => {
    setConfidence(0.5);
    setMaxObjects(10);
    setNotifyEmail("");
    setObjects(DEFAULT_OBJECTS.map((o) => ({ ...o })));
    persistLocal();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      detectionThreshold: confidence,
      maxObjects,
      notifyEmail,
      objects,
    };
    try {
      await axios.put(`${apiBase}/api/settings`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      persistLocal();
    } catch {
      persistLocal();
    } finally {
      setSaving(false);
    }
  };

  // -------------------- FIXED EmailJS Logic --------------------
  const uploadFileToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post(`${apiBase}/api/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.url;
  };

  const handleSendEmail = async () => {
    if (!emailMessage.name.trim() || !emailMessage.email.trim()) {
      alert("⚠️ Please enter your name and email.");
      return;
    }

    setSendingEmail(true);
    try {
      let fileUrl = "";

      if (emailMessage.file) {
        const sizeMB = emailMessage.file.size / (1024 * 1024);
        if (sizeMB > 10) {
          alert("⚠️ File too large (max 10 MB allowed).");
          setSendingEmail(false);
          return;
        }
        fileUrl = await uploadFileToServer(emailMessage.file);
      }

      // ✅ Updated message (Ex29 Team)
      const templateParams = {
        title: "Notification — Ex29 Object Detection Alert 📩",
        name: emailMessage.name,
        email: emailMessage.email,
        message:
          emailMessage.text ||
          `Dear ${emailMessage.name},\n\nThis mail is from Ex29 Team regarding your Object Detection Alert Settings.\nPlease check your configured settings and uploaded objects.\n\nBest Regards,\nEx29 Technical Team`,
        time: new Date().toLocaleString(),
        attachment: fileUrl || "No attachment uploaded.",
      };

      const resp = await emailjs.send(
        EMAIL_SERVICE_ID,
        EMAIL_TEMPLATE_ID,
        templateParams,
        EMAIL_PUBLIC_KEY
      );

      console.log("✅ Email sent:", resp);
      alert(`✅ Email sent successfully to ${emailMessage.email}!`);
      setEmailMessage({ name: "", email: "", text: "", file: null });
    } catch (err: any) {
      console.error("❌ Email send error:", err);
      alert("❌ Failed to send email. Check console for details.");
    } finally {
      setSendingEmail(false);
    }
  };

  // -------------------- UI --------------------
  return (
    <section className="min-h-screen py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-4xl md:text-5xl font-bold font-serif mb-2">
            Detection <span className="text-primary">Settings</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Global detection parameters
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Detection Settings */}
          <Card className="p-6 bg-card border-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Confidence Threshold
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={confidence}
                    onChange={(e) => setConfidence(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="w-16 text-right font-mono">
                    {Math.round(confidence * 100)}%
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Objects
                </label>
                <Input
                  type="number"
                  value={maxObjects}
                  onChange={(e: any) =>
                    setMaxObjects(Number(e.target.value || 0))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Notification Email
                </label>
                <Input
                  type="email"
                  value={notifyEmail}
                  onChange={(e: any) => setNotifyEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </Card>

          {/* Object Toggles */}
          <Card className="p-6 bg-card border-2">
            <h3 className="text-xl font-semibold mb-4">Object Toggles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {objects.map((obj) => (
                <div
                  key={obj.id}
                  className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg"
                >
                  <div>
                    <div className="font-semibold">{obj.label}</div>
                    <div className="text-sm text-muted-foreground">
                      Detected {obj.count ?? 0} times
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {obj.enabled ? "Enabled" : "Disabled"}
                    </div>
                    <Checkbox
                      checked={obj.enabled}
                      onCheckedChange={(val) => handleToggle(obj.id, !!val)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Email Section */}
          <Card className="p-6 bg-card border-2">
            <h3 className="text-xl font-semibold mb-4">Send Email Alert</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fill in your name, email, message, and optionally attach a file.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={emailMessage.name}
                  onChange={(e) =>
                    setEmailMessage({ ...emailMessage, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailMessage.email}
                  onChange={(e) =>
                    setEmailMessage({ ...emailMessage, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Message</label>
              <Textarea
                placeholder="Write your message..."
                value={emailMessage.text}
                onChange={(e) =>
                  setEmailMessage({ ...emailMessage, text: e.target.value })
                }
                className="min-h-[120px]"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Attach File:</label>
                <Input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e: any) =>
                    setEmailMessage({
                      ...emailMessage,
                      file: e.target.files?.[0],
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 md:mt-0">
                <Button
                  className="bg-primary hover:bg-primary/90 gap-2 px-6"
                  onClick={() => void handleSendEmail()}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={resetDefaults} disabled={loading}>
              <RotateCw className="w-4 h-4 mr-2" /> Reset to Defaults
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4" />{" "}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
 