
import * as React from 'react';
import { dbStorage } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Zap, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Activity,
  Calendar,
  RefreshCw,
  Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';

interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  requestCount: number;
}

export default function TokenDashboard() {
  const [usage, setUsage] = React.useState<TokenUsage | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchUsage = async () => {
    setIsLoading(true);
    try {
      const data = await dbStorage.getItem<TokenUsage>('ai_token_usage');
      setUsage(data);
    } catch (err) {
      console.error('Failed to fetch token usage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsage();
  }, []);

  // Pricing based on Gemini 1.5 Flash (Estimated)
  // Input: $0.075 per 1M tokens ($0.000000075 per token)
  // Output: $0.30 per 1M tokens ($0.0000003 per token)
  const estimatedCost = usage 
    ? (usage.promptTokens * 0.000000075) + (usage.candidatesTokens * 0.0000003)
    : 0;

  const stats = [
    { 
      label: 'Tokens ทั้งหมด', 
      value: usage?.totalTokens?.toLocaleString() || '0', 
      icon: Zap, 
      color: 'bg-amber-500', 
      textColor: 'text-amber-600',
      description: 'โควต้าที่ใช้ไปทั้งหมด' 
    },
    { 
      label: 'Input (Prompt)', 
      value: usage?.promptTokens?.toLocaleString() || '0', 
      icon: ArrowUpCircle, 
      color: 'bg-blue-500', 
      textColor: 'text-blue-600',
      description: 'คำสั่งและข้อมูลรูปภาพ' 
    },
    { 
      label: 'Output (Response)', 
      value: usage?.candidatesTokens?.toLocaleString() || '0', 
      icon: ArrowDownCircle, 
      color: 'bg-emerald-500', 
      textColor: 'text-emerald-600',
      description: 'คำตอบจาก AI' 
    },
    { 
      label: 'จำนวนการวิเคราะห์', 
      value: usage?.requestCount?.toLocaleString() || '0', 
      icon: Activity, 
      color: 'bg-indigo-500', 
      textColor: 'text-indigo-600',
      description: 'จำนวนคำขอที่ส่งไปยัง AI' 
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">AI Token Dashboard</h1>
            <p className="text-slate-500 font-medium tracking-wide">สถิติการใช้งานพลังประมวลผลของ AI ในระบบ</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchUsage} 
            disabled={isLoading}
            className="rounded-xl border-slate-200 hover:bg-white bg-white shadow-sm font-bold"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            อัปเดตข้อมูล
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-none shadow-sm h-full overflow-hidden rounded-[32px]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">
                    {stat.label}
                  </CardTitle>
                  <div className={`${stat.color} p-2 rounded-xl text-white`}>
                    <stat.icon size={20} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-black text-slate-900 mb-1">{stat.value}</div>
                  <p className="text-xs font-bold text-slate-400 tracking-wide uppercase italic">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Detailed Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Estimated Cost Card */}
          <Card className="lg:col-span-1 border-none shadow-xl bg-indigo-600 rounded-[40px] text-white p-8 overflow-hidden relative group">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50 group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10 space-y-8">
              <div className="bg-white/20 w-fit p-4 rounded-2xl">
                <Coins className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-4">
                <h2 className="text-xl font-bold uppercase tracking-widest opacity-80">Estimated Cost</h2>
                <div className="space-y-1">
                  <div className="text-5xl font-black tracking-tighter">
                    ${estimatedCost.toFixed(4)}
                  </div>
                  <p className="text-sm font-bold tracking-widest uppercase opacity-60">
                    USD (Based on Flash Pricing)
                  </p>
                </div>
              </div>
              <div className="pt-4 p-4 bg-white/10 rounded-2xl border border-white/10">
                <p className="text-xs font-medium leading-relaxed opacity-90">
                  *ราคานี้เป็นเพียงการประมาณการเบื้องต้นตามอัตราค่าบริการมาตรฐานของ Gemini 1.5 Flash เพื่อให้เห็นภาพรวมของค่าใช้จ่ายที่เกิดขึ้น
                </p>
              </div>
            </div>
          </Card>

          {/* Info Card */}
          <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[40px] p-8 overflow-hidden">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-xl">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">เกี่ยวกับ Token ข้อมูล</h2>
              </div>
              
              <div className="space-y-4 text-slate-600 font-medium text-lg leading-relaxed">
                <p>
                  Tokens คือหน่วยพื้นฐานที่ AI ใช้ในการวัดปริมาณข้อมูล ในแอปพลิเคชันนี้ 
                  ส่วนใหญ่จะถูกใช้ไปกับ **รูปภาพ (Visual Data)** ซึ่งรูปภาพหนึ่งรูปอาจใช้ได้ตั้งแต่ 258 ถึง 1,000+ tokens ขึ้นอยู่กับขนาดและรายละเอียด
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-slate-900 mb-2 uppercase text-sm tracking-widest">Input</h4>
                    <p className="text-sm">รวมรูปภาพอ้างอิง, คำอธิบายจากผู้ใช้, และรูปภาพร้านค้าที่ส่งไปตรวจสอบ</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h4 className="font-black text-slate-900 mb-2 uppercase text-sm tracking-widest">Output</h4>
                    <p className="text-sm">ผลการวิเคราะห์ JSON ที่ AI ตอบกลับมา รวมถึงคำแนะนำและคะแนน</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400 font-bold italic pt-4">
                  *สถิตินี้ถูกเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น หากคุณล้างข้อมูลทั้งหมดในเครื่อง สถิตินี้จะหายไปด้วย
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
