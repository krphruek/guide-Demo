
import * as React from 'react';
import { 
  Trash2, 
  Edit3, 
  FileText, 
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Copy,
  Check,
  Info,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Plus,
  Building2,
  AlertCircle,
  MoreVertical,
  Settings2,
  LayoutGrid,
  CloudUpload,
  CloudDownload,
  Table
} from 'lucide-react';
import { googleSheetsService } from '@/services/googleSheetsService';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Guideline, Company } from '@/types/audit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { generateGuidelineRules, generateAutoGuideline } from '@/lib/gemini';
import { compressImage } from '@/lib/imageUtils';
import { dbStorage } from '@/lib/db';
import JSZip from 'jszip';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GuidelineManager() {
  const [guidelines, setGuidelines] = React.useState<Guideline[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>('all');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = React.useState(false);
  const [editingGuideline, setEditingGuideline] = React.useState<Guideline | null>(null);
  const [editingCompany, setEditingCompany] = React.useState<Company | null>(null);
  const [companyNameInput, setCompanyNameInput] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [isGeneratingRules, setIsGeneratingRules] = React.useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [appsScriptUrl, setAppsScriptUrl] = React.useState(localStorage.getItem('apps_script_url') || 'https://script.google.com/macros/s/AKfycbzmq5CkAtDcvzqV63i5_gRpRt3bAXhxa0mN3-LrPM_1v4H002uyRDImhIOQV4UdwokX/exec');
  const [n8nWebhookUrl, setN8nWebhookUrl] = React.useState(localStorage.getItem('n8n_webhook_url') || '');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isTestingN8n, setIsTestingN8n] = React.useState(false);

  const cleanUrl = (url: string) => {
    let cleaned = url.trim();
    if (!cleaned) return '';
    
    // Handle double pastes or mangled prefixes
    if (cleaned.includes('https://') && cleaned.lastIndexOf('https://') > 0) {
      cleaned = cleaned.substring(cleaned.lastIndexOf('https://'));
    }

    // Extract exactly the URL part if there's other text
    const urlMatch = cleaned.match(/https:\/\/script\.google\.com\/macros\/s\/[^\s/]+\/exec/);
    if (urlMatch) {
      return urlMatch[0];
    }
    
    return cleaned;
  };

  const handleSyncToSheets = async () => {
    const finalUrl = cleanUrl(appsScriptUrl);
    if (!finalUrl || !finalUrl.startsWith('https://script.google.com')) {
      alert('กรุณาใส่ URL ของ Apps Script ให้ถูกต้องครับ (ต้องขึ้นต้นด้วย https://script.google.com และลงท้ายด้วย /exec)');
      return;
    }

    setIsSyncing(true);
    try {
      await googleSheetsService.syncToSheets(guidelines, finalUrl);
      alert('ส่งข้อมูลไปยัง Google Sheets สำเร็จ!');
    } catch (error: any) {
      console.error('Sync error:', error);
      alert(`Sync Error:\n${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchFromSheets = async () => {
    const finalUrl = cleanUrl(appsScriptUrl);
    if (!finalUrl || !finalUrl.startsWith('https://script.google.com')) {
      alert('กรุณาใส่ URL ของ Apps Script ให้ถูกต้องครับ (ต้องขึ้นต้นด้วย https://script.google.com และลงท้ายด้วย /exec)');
      return;
    }

    if (!window.confirm('คุณต้องการดึงข้อมูลจาก Google Sheets ใช่หรือไม่? ข้อมูลในเครื่องอาจถูกเขียนทับ')) return;
    
    setIsSyncing(true);
    try {
      const data = await googleSheetsService.fetchFromSheets(finalUrl);
      if (data && data.length > 0) {
        setGuidelines(data);
        await dbStorage.setItem('store_guidelines', data);
        calculateStorageUsage();
        alert('ดึงข้อมูลจาก Google Sheets สำเร็จ!');
      } else {
        alert('ไม่พบข้อมูลใน Google Sheets');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Fetch Error:\n${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveUrl = () => {
    const cleanedUrl = cleanUrl(appsScriptUrl);
    
    if (cleanedUrl && !cleanedUrl.startsWith('https://script.google.com')) {
      alert('URL ไม่ถูกต้อง ลิงก์ต้องขึ้นต้นด้วย https://script.google.com และลงท้ายด้วย /exec\nกรุณาตรวจสอบอีกครั้งครับ');
      return;
    }

    setAppsScriptUrl(cleanedUrl);
    localStorage.setItem('apps_script_url', cleanedUrl);
    
    if (n8nWebhookUrl) {
      localStorage.setItem('n8n_webhook_url', n8nWebhookUrl.trim());
    }
    
    alert('บันทึกการตั้งค่าเรียบร้อยแล้วครับ');
  };

  const handleTestN8n = async () => {
    if (!n8nWebhookUrl) {
      alert('กรุณาใส่ URL ของ n8n ก่อนกดทดสอบครับ');
      return;
    }

    // 0. Check for localhost/127.0.0.1 which won't work from Cloud
    const lowerUrl = n8nWebhookUrl.toLowerCase();
    if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
      alert('⚠️ ตรวจพบการใช้ localhost หรือ 127.0.0.1!\n\nแอปนี้รันอยู่บน Cloud (อินเทอร์เน็ต) จึงไม่สามารถเข้าถึงคำว่า "localhost" ในเครื่องคอมพิวเตอร์ของคุณได้โดยตรง\n\nวิธีแก้:\nคุณต้องใช้ ngrok เพื่อสร้างลิงก์สาธารณะ (Public URL) เช่น https://xxxx.ngrok-free.app แทนครับ');
      return;
    }
    
    setIsTestingN8n(true);
    console.log('Testing connection to:', n8nWebhookUrl);

    try {
      // Use proxy if it's HTTP to avoid Mixed Content error
      const isHttp = n8nWebhookUrl.toLowerCase().startsWith('http:');
      const targetUrl = isHttp ? '/api/n8n/proxy' : n8nWebhookUrl;
      const payload = { 
        action: 'test_connection', 
        timestamp: new Date().toISOString(),
        source: 'StoreLayoutAuditor_App'
      };

      // 2. Perform Fetch with Timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isHttp ? { url: n8nWebhookUrl, data: payload } : payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        alert('✅ เชื่อมต่อสำเร็จ!\n\nn8n ได้รับข้อมูลการทดสอบเรียบร้อยแล้วครับ');
      } else {
        const body = await res.text().catch(() => 'no body');
        alert(`❌ เชื่อมต่อได้แต่ n8n ตอบกลับด้วย Error:\n\nStatus: ${res.status} ${res.statusText}\nDetail: ${body}`);
      }
    } catch (err: any) {
      console.error('Test N8N detail error:', err);
      let message = err.message;
      
      if (err.name === 'AbortError') {
        message = 'การเชื่อมต่อใช้เวลานานเกินไป (Timeout)\nตรวจสอบว่าอินเทอร์เน็ตปกติ และ n8n ยังรันอยู่หรือไม่';
      } else if (message.includes('Failed to fetch')) {
        message = 'ไม่สามารถเชื่อมต่อได้ (Failed to fetch)\n\nเช็คลิสต์:\n1. กด "Listen for Test Event" ใน n8n แล้วหรือยัง?\n2. URL ถูกต้องไหม?\n3. ถ้า n8n อยู่ในคอมตัวเอง ต้องใช้ ngrok ช่วยครับ';
      }
      
      alert(`⚠️ เกิดข้อผิดพลาด:\n${message}`);
    } finally {
      setIsTestingN8n(false);
    }
  };

  const [aiPrompt, setAiPrompt] = React.useState('');
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
  const [viewingGuideline, setViewingGuideline] = React.useState<Guideline | null>(null);
  const [viewImageIndex, setViewImageIndex] = React.useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [guidelineToDelete, setGuidelineToDelete] = React.useState<Guideline | null>(null);
  const [isCompanyDeleteDialogOpen, setIsCompanyDeleteDialogOpen] = React.useState(false);
  const [companyToDelete, setCompanyToDelete] = React.useState<Company | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [storageUsage, setStorageUsage] = React.useState(0);
  
  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    rules: '',
    companyId: '',
    images: [] as string[]
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mainFileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Load guidelines
        let guidelinesData = await dbStorage.getItem<Guideline[]>('store_guidelines');
        if (!guidelinesData) {
          const saved = localStorage.getItem('store_guidelines');
          if (saved) guidelinesData = JSON.parse(saved);
        }
        
        // Load companies
        let companiesData = await dbStorage.getItem<Company[]>('store_companies');
        if (!companiesData) {
          const saved = localStorage.getItem('store_companies');
          if (saved) companiesData = JSON.parse(saved);
        }

        if (!guidelinesData) guidelinesData = [];
        if (!companiesData) companiesData = [];

        if (companiesData.length === 0) {
          const defaultCompany: Company = {
            id: 'default',
            name: 'studio7',
            createdAt: new Date().toISOString()
          };
          companiesData = [defaultCompany];
        } else {
          companiesData = companiesData.map(c => 
            c.name === 'บริษัททั่วไป' || c.id === 'default' ? { ...c, name: 'studio7' } : c
          );
        }

        const studio7Id = companiesData.find(c => c.name === 'studio7')?.id || 'default';
        guidelinesData = guidelinesData.map(g => ({
          ...g,
          companyId: g.companyId || studio7Id
        }));

        setGuidelines(guidelinesData);
        setCompanies(companiesData);
        
        // Initial storage sync to IndexedDB if it was only in localStorage
        await dbStorage.setItem('store_guidelines', guidelinesData);
        await dbStorage.setItem('store_companies', companiesData);
        
        calculateStorageUsage();
      } catch (err) {
        console.error('Failed to load storage data:', err);
      }
    };

    loadData();
  }, []);

  const calculateStorageUsage = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage !== undefined) {
        setStorageUsage(estimate.usage / (1024 * 1024)); // MB
      }
    } else {
      // Fallback
      let total = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += (localStorage[key].length * 2);
        }
      }
      setStorageUsage(total / (1024 * 1024));
    }
  };

  const saveToStorage = async (updated: Guideline[]) => {
    try {
      await dbStorage.setItem('store_guidelines', updated);
      setGuidelines(updated);
      calculateStorageUsage();
    } catch (error) {
      console.error('Storage error:', error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล พื้นที่จัดเก็บอาจไม่เพียงพอ");
    }
  };

  const clearAllData = async () => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้")) {
      await dbStorage.clear();
      localStorage.removeItem('store_guidelines');
      localStorage.removeItem('store_companies');
      window.location.reload();
    }
  };

  const saveCompaniesToStorage = async (updated: Company[]) => {
    try {
      await dbStorage.setItem('store_companies', updated);
      setCompanies(updated);
    } catch (error) {
      console.error('Storage error:', error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลบริษัท");
    }
  };

  const handleAddOrUpdate = () => {
    if (!formData.name || !formData.rules || !formData.companyId) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงเลือกบริษัท");
      return;
    }

    if (editingGuideline) {
      const updated = guidelines.map(g => 
        g.id === editingGuideline.id 
          ? { ...g, ...formData } 
          : g
      );
      saveToStorage(updated);
    } else {
      const newItem: Guideline = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString()
      };
      saveToStorage([newItem, ...guidelines]);
    }

    resetForm();
  };

  const handleAddOrUpdateCompany = () => {
    if (!companyNameInput.trim()) return;

    if (editingCompany) {
      const updated = companies.map(c => 
        c.id === editingCompany.id ? { ...c, name: companyNameInput } : c
      );
      saveCompaniesToStorage(updated);
      setEditingCompany(null);
    } else {
      const newCompany: Company = {
        id: Date.now().toString(),
        name: companyNameInput,
        createdAt: new Date().toISOString()
      };
      saveCompaniesToStorage([...companies, newCompany]);
    }
    setCompanyNameInput('');
  };

  const handleDeleteCompany = (id: string) => {
    if (companies.length <= 1) {
      alert("ต้องมีอย่างน้อยหนึ่งบริษัท");
      return;
    }
    const company = companies.find(c => c.id === id);
    if (company) {
      setCompanyToDelete(company);
      setIsCompanyDeleteDialogOpen(true);
    }
  };

  const confirmDeleteCompany = () => {
    if (companyToDelete) {
      const updated = companies.filter(c => c.id !== companyToDelete.id);
      saveCompaniesToStorage(updated);
      if (selectedCompanyId === companyToDelete.id) setSelectedCompanyId('all');
      setIsCompanyDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', rules: '', companyId: '', images: [] });
    setAiPrompt('');
    setEditingGuideline(null);
    setIsAddDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const guideline = guidelines.find(g => g.id === id);
    if (guideline) {
      setGuidelineToDelete(guideline);
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (guidelineToDelete) {
      const updated = guidelines.filter(g => g.id !== guidelineToDelete.id);
      saveToStorage(updated);
      setIsDeleteDialogOpen(false);
      setGuidelineToDelete(null);
    }
  };

  const handleView = (guideline: Guideline) => {
    setViewingGuideline(guideline);
    setViewImageIndex(0);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (guideline: Guideline) => {
    setEditingGuideline(guideline);
    setFormData({
      name: guideline.name,
      description: guideline.description,
      rules: guideline.rules,
      companyId: guideline.companyId || '',
      images: guideline.images
    });
    setIsAddDialogOpen(true);
  };

  const filteredGuidelines = selectedCompanyId === 'all' 
    ? guidelines 
    : guidelines.filter(g => g.companyId === selectedCompanyId);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    
    const isPptx = (file: File) => 
      file.name.endsWith('.pptx') || 
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const validFiles = files.filter(file => file.type.startsWith('image/') || isPptx(file));
    const invalidFilesCount = files.length - validFiles.length;
    
    if (invalidFilesCount > 0) {
      alert(`พบไฟล์ที่ไม่รองรับ (${invalidFilesCount} ไฟล์): กรุณาเลือกเฉพาะรูปภาพหรือไฟล์ PowerPoint (.pptx) เท่านั้น`);
    }

    const imagesToLoad: {data: any, name: string}[] = [];

    for (const file of validFiles) {
      if (isPptx(file)) {
        try {
          const zip = await JSZip.loadAsync(file);
          const imageFiles = zip.file(/ppt\/media\/.*\.(png|jpe?g|gif|bmp|webp)$/i);
          
          for (const zipFile of imageFiles) {
            const blob = await zipFile.async("blob");
            
            // Ensure valid MIME type for extracted files
            let mimeType = blob.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
              const extension = zipFile.name.split('.').pop()?.toLowerCase();
              if (extension === 'png') mimeType = 'image/png';
              else if (extension === 'webp') mimeType = 'image/webp';
              else mimeType = 'image/jpeg';
            }
            const blobWithMime = blob.slice(0, blob.size, mimeType);

            imagesToLoad.push({ data: blobWithMime, name: `${file.name} > ${zipFile.name.split('/').pop()}` });
          }
        } catch (err) {
          console.error("Error extraction from PPTX:", err);
        }
      } else {
        imagesToLoad.push({ data: file, name: file.name });
      }
    }

    if (imagesToLoad.length === 0) return;

    setIsProcessing(true); // Added processing state for UX
    const finalImages: string[] = [];

    const readFileAsBase64 = (file: Blob): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    };

    try {
      for (const item of imagesToLoad) {
        const base64 = await readFileAsBase64(item.data);
        const compressed = await compressImage(base64, 720, 720, 0.6);
        finalImages.push(compressed);
      }
      
      if (finalImages.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...finalImages]
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const isPptx = (file: File) => 
      file.name.endsWith('.pptx') || 
      file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    const validFiles = files.filter(file => file.type.startsWith('image/') || isPptx(file));
    const invalidFilesCount = files.length - validFiles.length;
    
    if (invalidFilesCount > 0) {
      alert(`พบไฟล์ที่ไม่รองรับ (${invalidFilesCount} ไฟล์): กรุณาเลือกเฉพาะรูปภาพหรือไฟล์ PowerPoint (.pptx) สำหรับสร้างเกณฑ์เท่านั้น`);
    }

    if (validFiles.length === 0) return;

    const newImages: string[] = [];
    const imagesToProcess: {data: any, type: string}[] = [];

    // Helper to process all binaries first
    for (const file of validFiles) {
      if (isPptx(file)) {
        try {
          const zip = await JSZip.loadAsync(file);
          const imageFiles = zip.file(/ppt\/media\/.*\.(png|jpe?g|gif|bmp|webp)$/i);
          for (const zipFile of imageFiles) {
            const blob = await zipFile.async("blob");
            
            // Ensure valid MIME type
            let mimeType = blob.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
              const extension = zipFile.name.split('.').pop()?.toLowerCase();
              if (extension === 'png') mimeType = 'image/png';
              else if (extension === 'webp') mimeType = 'image/webp';
              else mimeType = 'image/jpeg';
            }
            const blobWithMime = blob.slice(0, blob.size, mimeType);
            
            imagesToProcess.push({ data: blobWithMime, type: 'blob' });
          }
        } catch (err) {
          console.error("PPTX Error:", err);
        }
      } else {
        imagesToProcess.push({ data: file, type: 'file' });
      }
    }

    if (imagesToProcess.length === 0) return;

    setIsAutoGenerating(true);
    const finalNewImages: string[] = [];

    const readFileAsBase64 = (file: Blob): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    };

    try {
      for (const item of imagesToProcess) {
        const base64 = await readFileAsBase64(item.data);
        const compressed = await compressImage(base64, 720, 720, 0.6);
        finalNewImages.push(compressed);
      }

      let autoGuideline;
      const useN8n = false;
      if (useN8n && n8nWebhookUrl) {
        // ... n8n logic
      } else {
        autoGuideline = await generateAutoGuideline(finalNewImages);
      }

      const newItem: Guideline = {
        id: Date.now().toString(),
        name: autoGuideline.name,
        description: autoGuideline.description,
        rules: autoGuideline.rules,
        images: finalNewImages,
        companyId: selectedCompanyId === 'all' ? (companies[0]?.id || 'default') : selectedCompanyId,
        createdAt: new Date().toISOString()
      };
      const updated = [newItem, ...guidelines];
      saveToStorage(updated);
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการสร้างเกณฑ์อัตโนมัติ: ${err.message}`);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const copyRules = (rules: string, id: string) => {
    navigator.clipboard.writeText(rules);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateRules = async () => {
    if (formData.images.length === 0) {
      alert("กรุณาอัปโหลดรูปภาพอ้างอิงอย่างน้อย 1 รูป");
      return;
    }
    setIsGeneratingRules(true);
    try {
      let generated;
      
      // Force normal function (Gemini) instead of n8n
      const useN8n = false;

      if (useN8n && n8nWebhookUrl) {
        try {
          // Use proxy if it's HTTP to avoid Mixed Content error
          const isHttp = n8nWebhookUrl.toLowerCase().startsWith('http:');
          const targetUrl = isHttp ? '/api/n8n/proxy' : n8nWebhookUrl;
          const payload = {
            action: 'generate_rules',
            prompt: aiPrompt,
            images: formData.images
          };

          const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isHttp ? { url: n8nWebhookUrl, data: payload } : payload)
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(errorData.error || `n8n error: ${res.status}`);
          }
          const data = await res.json();
          generated = data.rules || data;
        } catch (fetchErr: any) {
          console.error(fetchErr);
          throw new Error('ไม่สามารถเชื่อมต่อกับ n8n ได้');
        }
      } else {
        generated = await generateGuidelineRules(aiPrompt, formData.images);
      }
      
      setFormData(prev => ({ ...prev, rules: generated }));
    } catch (err: any) {
      console.error(err);
      alert(`เกิดข้อผิดพลาดในการสร้างกฎ: ${err.message}`);
    } finally {
      setIsGeneratingRules(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200 px-2 py-0.5">
                <Sparkles className="w-3 h-3 mr-1" />
                การจัดการเกณฑ์การตรวจสอบ
              </Badge>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">คลังเกณฑ์การตรวจสอบ</h1>
            <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
              จัดการมาตรฐานการจัดวางสินค้าของคุณ AI จะใช้ข้อมูลเหล่านี้ในการตรวจสอบความถูกต้องโดยอัตโนมัติ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            <Card className="border-slate-200 shadow-sm rounded-[32px] overflow-hidden bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    บริษัท
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => setIsCompanyDialogOpen(true)}
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedCompanyId('all')}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                      selectedCompanyId === 'all' 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    ทั้งหมด
                    <Badge className={cn("ml-auto", selectedCompanyId === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                      {guidelines.length}
                    </Badge>
                  </button>
                  {companies.map(company => (
                    <button
                      key={company.id}
                      onClick={() => setSelectedCompanyId(company.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                        selectedCompanyId === company.id 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="truncate">{company.name}</span>
                      <Badge className={cn("ml-auto", selectedCompanyId === company.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                        {guidelines.filter(g => g.companyId === company.id).length}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 gap-4">
              <Card className="border-slate-200 shadow-sm bg-white rounded-[32px] overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-xl">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ทั้งหมด</p>
                    <p className="text-2xl font-black text-slate-900">{guidelines.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm bg-white rounded-[32px] overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-xl">
                    <ImageIcon className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">รูปอ้างอิง</p>
                    <p className="text-2xl font-black text-slate-900">
                      {guidelines.reduce((acc, curr) => acc + curr.images.length, 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Storage Usage */}
            <Card className="border-slate-200 shadow-sm bg-white rounded-[32px] overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">พื้นที่จัดเก็บ</p>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold",
                    storageUsage > 450 ? "text-rose-600 border-rose-200 bg-rose-50" : "text-indigo-600 border-indigo-100 bg-indigo-50"
                  )}>
                    {storageUsage.toFixed(1)} MB (Large Storage)
                  </Badge>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      storageUsage > 450 ? "bg-rose-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${Math.min(100, (storageUsage / 500) * 100)}%` }}
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllData}
                  className="w-full text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-7 rounded-lg"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> ล้างข้อมูลทั้งหมด
                </Button>
              </CardContent>
            </Card>

            {/* Google Sheets Integration (Apps Script) */}
            <Card className="border-slate-200 shadow-sm bg-white rounded-[32px] overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Sheets (Apps Script)</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500">Web App URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={appsScriptUrl}
                        onChange={(e) => setAppsScriptUrl(e.target.value)}
                        className="text-[10px] h-8 bg-slate-50 border-slate-200 rounded-lg focus:ring-emerald-500"
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={handleSaveUrl}
                        className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-[8px] text-slate-400 leading-tight">
                      * ต้องเลือก "Anyone" ในช่อง "Who has access" ตอน Deploy
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isSyncing || !appsScriptUrl}
                      onClick={handleSyncToSheets}
                      className="text-[10px] font-bold h-9 rounded-xl border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                    >
                      {isSyncing ? (
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <CloudUpload className="w-3 h-3 mr-1" />
                      )}
                      ส่งข้อมูล
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isSyncing || !appsScriptUrl}
                      onClick={handleFetchFromSheets}
                      className="text-[10px] font-bold h-9 rounded-xl border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                    >
                      {isSyncing ? (
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <CloudDownload className="w-3 h-3 mr-1" />
                      )}
                      ดึงข้อมูล
                    </Button>
                  </div>
                </div>

                {/* Advanced Integration - Simple Toggle */}
                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-0 h-6 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-widest">การเชื่อมต่อขั้นสูง</span>
                    </div>
                    {showAdvanced ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                  
                  {showAdvanced && (
                    <div className="space-y-3 pt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-slate-500">n8n Webhook URL</Label>
                        <Input 
                          placeholder="https://your-n8n-instance.com/webhook/..."
                          value={n8nWebhookUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setN8nWebhookUrl(val);
                            localStorage.setItem('n8n_webhook_url', val.trim());
                          }}
                          className="text-[10px] h-8 bg-slate-50 border-slate-200 rounded-lg focus:ring-indigo-500"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.preventDefault();
                            handleTestN8n();
                          }}
                          disabled={isTestingN8n || !n8nWebhookUrl}
                          className="w-full text-[10px] font-bold h-8 mt-2 border-indigo-100 hover:bg-indigo-50 text-indigo-600 active:scale-95"
                        >
                          {isTestingN8n ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ (n8n)'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="space-y-8">
            {/* Drop Zone Area */}
            <div 
              onClick={() => !isAutoGenerating && mainFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (isAutoGenerating) return;
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                  const event = { target: { files } } as any;
                  handleMainImageUpload(event);
                }
              }}
              className={cn(
                "group relative cursor-pointer",
                isAutoGenerating && "cursor-wait opacity-80"
              )}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative border-2 border-dashed border-indigo-200 bg-white hover:border-indigo-400 transition-all rounded-[32px] overflow-hidden">
                <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                  {isAutoGenerating ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-600 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-slate-900">AI กำลังวิเคราะห์และสร้างเกณฑ์...</h3>
                        <p className="text-slate-500 font-medium">กรุณารอสักครู่ ระบบกำลังสรุปมาตรฐานจากรูปภาพของคุณ</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-indigo-50 p-6 rounded-full group-hover:scale-110 transition-transform duration-500">
                        <Upload className="w-10 h-10 text-indigo-600" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-slate-900">อัปโหลดรูปภาพเพื่อสร้างเกณฑ์อัตโนมัติ</h3>
                        <p className="text-slate-500 font-medium">ลากรูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์ (AI จะสรุปเกณฑ์ให้ทันที)</p>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Button 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-2xl font-bold shadow-lg shadow-indigo-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddDialogOpen(true);
                          }}
                        >
                          <Plus className="w-5 h-5 mr-2" />
                          เพิ่มเกณฑ์ด้วยตนเอง
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <input 
              type="file" 
              ref={mainFileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleMainImageUpload}
            />

            {/* Guidelines Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {filteredGuidelines.map((g, index) => (
                  <motion.div
                    key={g.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="group flex flex-col border-slate-200 bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-3xl overflow-hidden min-h-[500px]"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                        {g.images.length > 0 ? (
                          <img 
                            src={g.images[0]} 
                            alt={g.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                            <ImageIcon className="w-12 h-12 opacity-20" />
                            <span className="text-xs font-bold uppercase tracking-widest opacity-40">ไม่มีรูปภาพ</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        <div className="absolute top-4 right-4 flex gap-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="h-10 w-10 bg-white/90 backdrop-blur hover:bg-white shadow-lg rounded-xl"
                            onClick={() => handleEdit(g)}
                          >
                            <Edit3 className="w-5 h-5 text-slate-700" />
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-10 w-10 bg-rose-500/90 backdrop-blur hover:bg-rose-600 shadow-lg rounded-xl"
                            onClick={() => handleDelete(g.id)}
                          >
                            <Trash2 className="w-5 h-5 text-white" />
                          </Button>
                        </div>

                        {g.images.length > 1 && (
                          <Badge className="absolute bottom-4 left-4 bg-white/20 backdrop-blur-md text-white border-white/30 px-3 py-1 rounded-full text-xs font-bold">
                            +{g.images.length - 1} รูปภาพอ้างอิง
                          </Badge>
                        )}

                        <Badge className="absolute top-4 left-4 bg-indigo-600 text-white border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {companies.find(c => c.id === g.companyId)?.name || 'ไม่ระบุบริษัท'}
                        </Badge>
                      </div>

                      <CardHeader className="p-6 space-y-3">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                            {g.name}
                          </CardTitle>
                          <CardDescription className="text-slate-500 line-clamp-2 text-sm leading-relaxed">
                            {g.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="px-6 pb-6 pt-0 flex-1 flex flex-col">
                        <div className="flex-1 bg-slate-50 rounded-2xl p-4 mb-6 relative group/rules">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            สรุปกฎการตรวจสอบ
                          </p>
                          <p className="text-sm text-slate-600 line-clamp-3 font-medium leading-relaxed">
                            {g.rules}
                          </p>
                          <button 
                            onClick={() => copyRules(g.rules, g.id)}
                            className="absolute top-3 right-3 p-2 rounded-lg bg-white shadow-sm opacity-0 group-hover/rules:opacity-100 transition-opacity hover:bg-slate-50"
                          >
                            {copiedId === g.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Calendar className="w-3 h-3" />
                            {new Date(g.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </div>
                          <Button 
                            variant="ghost" 
                            className="group/btn text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-0 h-auto font-bold text-sm" 
                            onClick={() => handleView(g)}
                          >
                            ดูรายละเอียด <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {filteredGuidelines.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <FileText className="w-12 h-12 text-slate-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">ไม่พบเกณฑ์การตรวจสอบ</h3>
                    <p className="text-slate-500">ยังไม่มีเกณฑ์สำหรับบริษัทนี้ หรือลองเปลี่ยนการค้นหา</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Tips Section */}
       
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="w-[98vw] max-w-6xl h-[92vh] md:h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[32px]">
          <DialogHeader className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl md:text-3xl font-black text-slate-900">
                    {editingGuideline ? 'แก้ไขเกณฑ์การตรวจสอบ' : 'เพิ่มเกณฑ์การตรวจสอบใหม่'}
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 font-medium">
                    {editingGuideline ? 'ปรับปรุงมาตรฐานการตรวจสอบเดิม' : 'สร้างมาตรฐานใหม่เพื่อใช้ในการตรวจสอบร้านค้า'}
                  </DialogDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm} className="rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Basic Info */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-black text-slate-700 uppercase tracking-widest">ชื่อเกณฑ์การตรวจสอบ</Label>
                    <Input 
                      id="name" 
                      placeholder="เช่น การจัดโต๊ะโปรโมชั่น Summer 2024" 
                      className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-lg font-medium"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="company" className="text-sm font-black text-slate-700 uppercase tracking-widest">บริษัท</Label>
                    <Select 
                      value={formData.companyId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: value }))}
                    >
                      <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-base font-medium">
                        <SelectValue placeholder="เลือกบริษัท" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-sm font-black text-slate-700 uppercase tracking-widest">คำอธิบายเพิ่มเติม</Label>
                    <Textarea 
                      id="description" 
                      placeholder="ระบุรายละเอียดคร่าวๆ เพื่อให้ทีมงานเข้าใจตรงกัน..." 
                      className="min-h-[100px] bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-base leading-relaxed"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center justify-between">
                      รูปภาพอ้างอิง (Golden Sample)
                      <span className="text-[10px] text-slate-400 font-bold">{formData.images.length} รูป</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <AnimatePresence mode="popLayout">
                        {formData.images.map((img, idx) => (
                          <motion.div 
                            key={idx} 
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative aspect-video rounded-2xl overflow-hidden border-2 border-slate-100 group shadow-sm"
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => removeImage(idx)}
                                className="bg-rose-500 text-white p-2 rounded-xl shadow-lg hover:scale-110 transition-transform"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 group"
                      >
                        <div className="p-3 rounded-full bg-slate-50 group-hover:bg-indigo-100 transition-colors">
                          <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">เพิ่มรูปภาพ</span>
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      multiple 
                      onChange={handleImageUpload} 
                      className="hidden" 
                      accept="image/*,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    />
                  </div>
                </div>

                {/* AI Rule Generation */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-indigo-900 rounded-[32px] p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Sparkles className="w-32 h-32" />
                    </div>
                    
                    <div className="relative space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-500 p-1.5 rounded-lg">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-widest">ระบบสร้างกฎด้วย AI</h3>
                        </div>
                        <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30">ผู้ช่วยอัจฉริยะ</Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="ai-prompt" className="text-xs font-bold text-indigo-300 uppercase tracking-widest">อธิบายเกณฑ์การตรวจสอบ (AI จะช่วยปรับปรุงให้แม่นยำขึ้น)</Label>
                        <Textarea 
                          id="ai-prompt" 
                          placeholder="เช่น 'จัดวาง iPhone 17 Pro ให้ห่างจากป้ายราคา 75mm และวาง Apple Watch ให้ตรงกับป้าย A5 Comparison...'" 
                          className="min-h-[120px] bg-white/10 border-white/20 rounded-2xl focus:ring-2 focus:ring-indigo-400/40 text-base leading-relaxed placeholder:text-white/30"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                        />
                      </div>

                      <Button 
                        onClick={handleGenerateRules}
                        disabled={isGeneratingRules || isProcessing || formData.images.length === 0}
                        className="w-full bg-white text-indigo-900 hover:bg-indigo-50 h-12 rounded-xl font-black text-base shadow-lg transition-all active:scale-95"
                      >
                        {isGeneratingRules || isProcessing ? (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                            {isProcessing ? 'กำลังเตรียมไฟล์...' : 'AI กำลังวิเคราะห์รูปภาพและสร้างกฎ...'}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            สร้างกฎการตรวจสอบด้วย AI
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="rules" className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      กฎการตรวจสอบที่สรุปแล้ว (Final Rules)
                    </Label>
                    <Textarea 
                      id="rules" 
                      placeholder="กฎที่ AI สร้างขึ้นจะปรากฏที่นี่ คุณสามารถแก้ไขเพิ่มเติมได้..." 
                      className="min-h-[250px] bg-white border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 text-lg leading-relaxed font-medium"
                      value={formData.rules}
                      onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <Button variant="ghost" onClick={resetForm} className="text-slate-500 font-bold hover:bg-slate-100">ยกเลิก</Button>
            <Button 
              onClick={handleAddOrUpdate} 
              disabled={!formData.name || !formData.rules}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 h-14 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 transition-all active:scale-95"
            >
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[98vw] max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[40px]">
          <div className="flex-1 overflow-y-auto p-8 md:p-12 scroll-smooth">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2 rounded-xl">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-3xl font-black text-slate-900">
                      รายละเอียดเกณฑ์การตรวจสอบ
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium">
                      {viewingGuideline?.name}
                    </DialogDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsViewDialogOpen(false)} className="rounded-full">
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="space-y-10">
                {/* Reference Images - Top */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">รูปภาพอ้างอิง (Golden Sample)</h4>
                    </div>
                    {viewingGuideline && viewingGuideline.images.length > 1 && (
                      <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                        <button 
                          onClick={() => setViewImageIndex(prev => (prev > 0 ? prev - 1 : viewingGuideline.images.length - 1))}
                          className="p-1 hover:bg-white rounded-full transition-colors text-slate-600"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-black text-slate-600 min-w-[3rem] text-center">
                          {viewImageIndex + 1} / {viewingGuideline.images.length}
                        </span>
                        <button 
                          onClick={() => setViewImageIndex(prev => (prev < viewingGuideline.images.length - 1 ? prev + 1 : 0))}
                          className="p-1 hover:bg-white rounded-full transition-colors text-slate-600"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative group/carousel">
                    <AnimatePresence mode="wait">
                      {viewingGuideline && viewingGuideline.images.length > 0 && (
                        <motion.div 
                          key={viewImageIndex}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3 }}
                          className="aspect-video rounded-[32px] overflow-hidden border-4 border-white shadow-2xl relative cursor-pointer ring-1 ring-slate-100"
                          onClick={() => {
                            setPreviewImage(viewingGuideline.images[viewImageIndex]);
                            setIsPreviewOpen(true);
                          }}
                        >
                          <img 
                            src={viewingGuideline.images[viewImageIndex]} 
                            alt="" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-indigo-900/10 opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-white/90 p-4 rounded-2xl shadow-2xl transform scale-90 group-hover/carousel:scale-100 transition-transform duration-300">
                              <Plus className="w-8 h-8 text-indigo-600" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {viewingGuideline && viewingGuideline.images.length > 1 && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewImageIndex(prev => (prev > 0 ? prev - 1 : viewingGuideline.images.length - 1));
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md hover:bg-white rounded-2xl shadow-xl text-slate-700 opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewImageIndex(prev => (prev < viewingGuideline.images.length - 1 ? prev + 1 : 0));
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/80 backdrop-blur-md hover:bg-white rounded-2xl shadow-xl text-slate-700 opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-10">
                  {/* Description */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">คำอธิบาย</h4>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                      <p className="text-slate-700 text-lg leading-relaxed font-medium">
                        {viewingGuideline?.description || "ไม่มีคำอธิบาย"}
                      </p>
                    </div>
                  </div>

                  {/* Audit Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">กฎการตรวจสอบ</h4>
                    </div>
                    <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-12 opacity-5">
                        <FileText className="w-48 h-48 text-white" />
                      </div>
                      <pre className="relative text-indigo-100 whitespace-pre-wrap font-mono text-base leading-loose">
                        {viewingGuideline?.rules}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
            <Button 
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewingGuideline) handleEdit(viewingGuideline);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-bold"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              แก้ไขข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 rounded-lg border border-slate-300 shadow-2xl overflow-hidden bg-[#f0f0f0]">
          {/* Windows-style Title Bar */}
          <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="text-sm font-semibold text-slate-700">Confirm Delete</span>
            </div>
            <button 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 bg-white flex gap-4">
            <div className="bg-rose-50 p-3 rounded-full h-fit">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-bold text-slate-900">ยืนยันการลบข้อมูล?</DialogTitle>
              <DialogDescription className="text-slate-600 font-medium leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบเกณฑ์ <span className="text-slate-900 font-bold">"{guidelineToDelete?.name}"</span>? 
                <br />
                <span className="text-rose-600 text-sm italic">* การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
              </DialogDescription>
            </div>
          </div>

          <div className="bg-[#f0f0f0] p-4 flex justify-end gap-2 border-t border-slate-200">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)} 
              className="h-9 px-6 rounded border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 shadow-sm"
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={confirmDelete} 
              className="h-9 px-6 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm"
            >
              ลบข้อมูล
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Delete Confirmation Dialog */}
      <Dialog open={isCompanyDeleteDialogOpen} onOpenChange={setIsCompanyDeleteDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 rounded-lg border border-slate-300 shadow-2xl overflow-hidden bg-[#f0f0f0]">
          {/* Windows-style Title Bar */}
          <div className="bg-white px-4 py-2 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-rose-600" />
              <span className="text-sm font-semibold text-slate-700">Confirm Delete Company</span>
            </div>
            <button 
              onClick={() => setIsCompanyDeleteDialogOpen(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 bg-white flex gap-4">
            <div className="bg-rose-50 p-3 rounded-full h-fit">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-bold text-slate-900">ยืนยันการลบบริษัท?</DialogTitle>
              <DialogDescription className="text-slate-600 font-medium leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบบริษัท <span className="text-slate-900 font-bold">"{companyToDelete?.name}"</span>? 
                <br />
                <span className="text-slate-500 text-sm italic">* เกณฑ์ที่เกี่ยวข้องจะยังคงอยู่แต่จะไม่มีบริษัทสังกัด</span>
              </DialogDescription>
            </div>
          </div>

          <div className="bg-[#f0f0f0] p-4 flex justify-end gap-2 border-t border-slate-200">
            <Button 
              variant="outline" 
              onClick={() => setIsCompanyDeleteDialogOpen(false)} 
              className="h-9 px-6 rounded border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 shadow-sm"
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={confirmDeleteCompany} 
              className="h-9 px-6 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm"
            >
              ลบข้อมูล
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-7xl p-0 overflow-hidden rounded-[32px] border-none bg-black/95">
          <div className="relative w-full h-full flex items-center justify-center min-h-[50vh] max-h-[90vh]">
            <button 
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-2 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {previewImage && (
              <img 
                src={previewImage} 
                alt="Full Preview" 
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <p className="text-white text-sm font-medium tracking-wide">รูปภาพอ้างอิง - มุมมองขยาย</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Management Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2 rounded-xl">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black text-slate-900">จัดการบริษัท</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium">เพิ่มหรือแก้ไขรายชื่อบริษัทในระบบ</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="flex gap-2">
              <Input 
                placeholder="ชื่อบริษัทใหม่..." 
                value={companyNameInput}
                onChange={(e) => setCompanyNameInput(e.target.value)}
                className="h-12 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
              <Button 
                onClick={handleAddOrUpdateCompany}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-12 rounded-xl font-bold"
              >
                {editingCompany ? 'บันทึก' : 'เพิ่ม'}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
                    <span className="font-bold text-slate-700">{company.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg hover:bg-white text-slate-400 hover:text-indigo-600"
                        onClick={() => {
                          setEditingCompany(company);
                          setCompanyNameInput(company.name);
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg hover:bg-white text-slate-400 hover:text-rose-600"
                        onClick={() => handleDeleteCompany(company.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCompanyDialogOpen(false);
                setEditingCompany(null);
                setCompanyNameInput('');
              }}
              className="w-full h-12 rounded-xl font-bold border-slate-200"
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

