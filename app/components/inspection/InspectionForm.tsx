'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getChecklistForType, EquipmentChecklist } from '@/app/lib/inspectionChecklists';
import CameraCapture from './CameraCapture';
import QRScannerModal from '@/app/components/ui/QRScannerModal';

interface EquipmentItem {
  id: string;
  no_id: string;
  type: string;
  entity: string;
  facility: string;
  area: string;
  location: string;
  pic_1?: { id?: string; name?: string; phone?: string } | null;
  pic_2?: { id?: string; name?: string; phone?: string } | null;
}

interface PicItem {
  id: string;
  name: string;
  phone?: string;
  signature_url?: string;
}

import { InspectionRecord } from './InspectionDetailModal';

const TYPE_FILTERS: { value: string; label: string; icon: React.ReactNode }[] = [
  {
    value: 'Fire Extinguisher',
    label: 'Fire Extinguisher',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v2" />
        <rect x="8" y="5" width="8" height="16" rx="2" />
        <rect x="10" y="2" width="4" height="3" rx="1" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    value: 'Fire Alarm',
    label: 'Fire Alarm',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    value: 'Fire Hydrant',
    label: 'Hydrant Hose',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v2" />
        <path d="M12 19v2" />
        <path d="M5 8h14" />
        <path d="M6.5 8 5 12h14l-1.5-4z" />
        <path d="M7 12v7M17 12v7" />
        <path d="M5 12H3M21 12h-2" />
      </svg>
    ),
  },
  {
    value: 'Emergency Lamp',
    label: 'Emergency Lamp',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
      </svg>
    ),
  },
];

interface InspectionFormProps {
  editRecord?: InspectionRecord | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InspectionForm({ editRecord, onSuccess, onCancel }: InspectionFormProps) {
  const [masterlist, setMasterlist] = useState<EquipmentItem[]>([]);
  const [picList, setPicList] = useState<PicItem[]>([]);

  // Selection & Filter states
  const [selectedFacility, setSelectedFacility] = useState<string>('All');
  const [userFacility, setUserFacility] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  
  const [checklist, setChecklist] = useState<EquipmentChecklist | null>(null);
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO' | 'NA'>>({});
  
  const [equipmentPhotoUrl, setEquipmentPhotoUrl] = useState<string | null>(null);
  const [checklistPhotoUrl, setChecklistPhotoUrl] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState<string>('');
  const [inspectionDate, setInspectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  
  // Auto calculated Week and Month/Year derived from Inspection Date
  const dateParts = inspectionDate.split('-');
  const week = dateParts.length === 3 ? `Week ${Math.min(4, Math.ceil(parseInt(dateParts[2], 10) / 7))}` : 'Week 1';
  const monthYear = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[0]}` : '';

  const [remarks, setRemarks] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLockedInspector, setIsLockedInspector] = useState(false);

  // Tracks whether the selected equipment has already been inspected in the current month+week
  const [duplicate, setDuplicate] = useState<{ inspector: string; date: string } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // All inspections (read-only) used to show weekly coverage vs the masterlist.
  const [weekInspections, setWeekInspections] = useState<
    { id: string; equipment_id: string; month_year: string; week: string }[]
  >([]);

  const supabase = getSupabaseClient();

  // Scroll to top of modal container whenever component mounts or selected equipment changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const modalContainers = document.querySelectorAll('.fixed.overflow-y-auto');
    modalContainers.forEach(el => el.scrollTo({ top: 0, behavior: 'instant' }));
  }, [selectedEquipment]);

  // Fetch masterlist equipment and PICs
  useEffect(() => {
    const loadData = async () => {
      setFetchingData(true);

      // Fetch Equipment
      const { data: eqData } = await supabase
        .from('equipment')
        .select(`
          id, no_id, type, entity, facility, area, location,
          pic_1:pic_1_id(id, name, phone),
          pic_2:pic_2_id(id, name, phone)
        `)
        .order('no_id', { ascending: true });

      const loadedEquipments = eqData ? (eqData as unknown as EquipmentItem[]) : [];
      setMasterlist(loadedEquipments);

      // Fetch PICs
      const { data: picsData } = await supabase
        .from('pic')
        .select('id, name, phone, signature_url')
        .order('name', { ascending: true });

      if (picsData) {
        setPicList(picsData as PicItem[]);
      }

      // Fetch inspections (read-only) for weekly coverage display against the masterlist
      const { data: inspData } = await supabase
        .from('inspections')
        .select('id, equipment_id, month_year, week');
      if (inspData) {
        setWeekInspections(inspData as { id: string; equipment_id: string; month_year: string; week: string }[]);
      }

      // Fetch current user role and pic
      const { data: sessionData } = await supabase.auth.getSession();
      let lockedName = null;
      if (sessionData?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, facility, entity, pic:pic_id(name, facility, entity)')
          .eq('id', sessionData.session.user.id)
          .single();
          
        if (profile?.role === 'inspector' && profile.pic?.name) {
          lockedName = profile.pic.name;
          setIsLockedInspector(true);
          setInspectorName(lockedName);
        }

        // Auto-scope equipment list to the facility detected from the logged-in account.
        // The facility filter is hidden for these users since it is always derived here.
        if (profile?.role !== 'admin') {
          const assignedFacility = profile?.facility || profile?.pic?.facility || null;
          if (assignedFacility) {
            setUserFacility(assignedFacility);
            setSelectedFacility(assignedFacility);
          }
        }
      }

      if (picsData && picsData.length > 0 && !lockedName && !editRecord) {
        setInspectorName(picsData[0].name); // default first PIC
      }

      // Pre-fill form if editing an existing inspection log
      if (editRecord) {
        const targetEq = loadedEquipments.find((e) => e.id === editRecord.equipment_id) || {
          id: editRecord.equipment_id,
          no_id: editRecord.equipment_no_id,
          type: editRecord.equipment_type,
          entity: editRecord.equipment?.entity || '',
          facility: editRecord.equipment?.facility || '',
          area: editRecord.equipment?.area || '',
          location: editRecord.equipment?.location || '',
        };
        setSelectedEquipment(targetEq);
        const cl = getChecklistForType(targetEq.type);
        setChecklist(cl);
        setAnswers(editRecord.answers || {});
        setInspectorName(editRecord.inspector_name || '');
        setInspectionDate(editRecord.inspection_date || new Date().toISOString().split('T')[0]);
        setRemarks(editRecord.remarks || '');
        setActionTaken(editRecord.action_taken || '');

        const photos = (editRecord.photo_url || '').split(',');
        setEquipmentPhotoUrl(photos[0] ? photos[0].trim() : null);
        setChecklistPhotoUrl(photos[1] ? photos[1].trim() : photos[0] ? photos[0].trim() : null);
      }

      setFetchingData(false);
    };

    loadData();
  }, [supabase, editRecord]);

  // Detect if the selected equipment was already inspected in the same month + week
  useEffect(() => {
    if (!selectedEquipment || !monthYear || !week) return;

    let cancelled = false;
    const checkDuplicate = async () => {
      setCheckingDuplicate(true);
      setDuplicate(null);
      let query = supabase
        .from('inspections')
        .select('inspector_name, inspection_date')
        .eq('equipment_id', selectedEquipment.id)
        .eq('month_year', monthYear)
        .eq('week', week);

      if (editRecord?.id) {
        query = query.neq('id', editRecord.id);
      }

      const { data } = await query.maybeSingle();
      if (!cancelled) {
        if (data) setDuplicate({ inspector: data.inspector_name, date: data.inspection_date });
        setCheckingDuplicate(false);
      }
    };

    checkDuplicate();
    return () => { cancelled = true; };
  }, [selectedEquipment, week, monthYear, supabase, editRecord]);

  // Unique list of facilities/factories for filter dropdown (admin fallback only)
  const uniqueFacilities = Array.from(
    new Set(masterlist.map((e) => e.facility).filter(Boolean))
  ).sort();

  // Weekly coverage vs the masterlist — read-only calculation, never mutates data.
  const inspectedThisWeek = new Set(
    weekInspections
      .filter((i) => i.month_year === monthYear && i.week === week)
      .map((i) => i.equipment_id)
  );
  const coverageEquipment = masterlist.filter((item) => {
    const matchesFacility = selectedFacility === 'All' || item.facility === selectedFacility;
    const matchesType = selectedTypeFilter === 'All' || item.type === selectedTypeFilter;
    return matchesFacility && matchesType;
  });
  const totalCoverage = coverageEquipment.length;
  const inspectedCoverage = coverageEquipment.filter((e) => inspectedThisWeek.has(e.id)).length;
  const remainingCoverage = Math.max(0, totalCoverage - inspectedCoverage);
  const coveragePct = totalCoverage > 0 ? Math.round((inspectedCoverage / totalCoverage) * 100) : 0;

  const applyEquipmentSelection = (item: EquipmentItem | null) => {
    setSelectedEquipment(item);

    if (!item) {
      setChecklist(null);
      setAnswers({});
      return;
    }

    const cl = getChecklistForType(item.type);
    setChecklist(cl);

    // Auto-select assigned PIC if available and inspector is not locked
    if (!isLockedInspector) {
      if (item.pic_1?.name) {
        setInspectorName(item.pic_1.name);
      } else if (item.pic_2?.name) {
        setInspectorName(item.pic_2.name);
      }
    }

    // Reset answers to expected normal answer (YES or NO)
    const initialAnswers: Record<string, 'YES' | 'NO' | 'NA'> = {};
    cl.sections.forEach((section) => {
      section.items.forEach((checklistItem) => {
        initialAnswers[checklistItem.id] = checklistItem.expectedAnswer || 'YES';
      });
    });
    setAnswers(initialAnswers);
  };

  // Filter equipment based on Facility, Type, and Search Query
  const filteredEquipment = masterlist.filter((item) => {
    const matchesFacility = selectedFacility === 'All' || item.facility === selectedFacility;
    const matchesType = selectedTypeFilter === 'All' || item.type === selectedTypeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      item.no_id.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.area.toLowerCase().includes(q) ||
      item.facility.toLowerCase().includes(q);

    return matchesFacility && matchesType && matchesSearch;
  });

  const handleSelectEquipment = (item: EquipmentItem) => {
    applyEquipmentSelection(item);
    setSearchQuery('');
  };

  const handleQrScan = (scanned: string) => {
    setShowQrScanner(false);
    setQrError(null);

    let value = scanned.trim();

    // Some scanners return the payload URL-encoded; normalize it first.
    try {
      const decoded = decodeURIComponent(value);
      if (decoded !== value) value = decoded.trim();
    } catch {
      // keep original value if decoding fails
    }

    const lower = value.toLowerCase();

    // Legacy ID tags encoded "{TYPE}-{no_id}" (e.g. "APAR-D1-001"), newer ones
    // encode the equipment's UUID directly. no_id in the masterlist is just "D1-001".
    const LEGACY_PREFIXES = ['apar', 'alarm', 'hydrant', 'emergency', 'exit'];

    const match =
      masterlist.find((e) => e.id === value) ||
      masterlist.find((e) => e.no_id.toLowerCase() === lower) ||
      masterlist.find((e) => {
        const noId = e.no_id.toLowerCase();
        return LEGACY_PREFIXES.some((p) => lower === `${p}-${noId}`) || lower.endsWith(`-${noId}`);
      });

    if (match) {
      applyEquipmentSelection(match);
      setSearchQuery('');
      return;
    }

    setQrError(`No equipment found for scanned code: "${value.slice(0, 50)}". Try again or select manually.`);
  };

  const handleAnswerChange = (itemId: string, value: 'YES' | 'NO' | 'NA') => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleMarkAllNormal = () => {
    if (!checklist) return;
    const allNormal: Record<string, 'YES' | 'NO' | 'NA'> = {};
    checklist.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        allNormal[item.id] = item.expectedAnswer || 'YES';
      });
    });
    setAnswers(allNormal);
  };

  // Check if all items match their expected normal answer ('NA' counts as normal when allowed)
  const isAllPass = checklist
    ? checklist.sections.every((sec) =>
        sec.items.every((item) => {
          const expected = item.expectedAnswer || 'YES';
          const value = answers[item.id];
          if (item.allowNA && value === 'NA') return true;
          return value === expected;
        })
      )
    : false;

  const computedStatus = isAllPass ? 'PASS' : 'NEEDS_ATTENTION';

  const totalQuestions = checklist
    ? checklist.sections.reduce((acc, sec) => acc + sec.items.length, 0)
    : 0;
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEquipment) {
      setErrorMsg('Please select an equipment from the masterlist.');
      return;
    }

    if (!equipmentPhotoUrl || !checklistPhotoUrl) {
      setErrorMsg('Mandatory: Please take both a live camera photo of the equipment and the printed checklist form.');
      return;
    }

    if (!inspectorName) {
      setErrorMsg('Please select an inspector from assigned PIC data.');
      return;
    }

    if (answeredCount < totalQuestions) {
      setErrorMsg('Please answer all inspection checklist questions.');
      return;
    }

    setLoading(true);

    try {
      // 0. Prevent duplicate: same equipment + same month/year + same week is already inspected
      let dupQuery = supabase
        .from('inspections')
        .select('id, inspector_name, inspection_date')
        .eq('equipment_id', selectedEquipment.id)
        .eq('month_year', monthYear)
        .eq('week', week);

      if (editRecord?.id) {
        dupQuery = dupQuery.neq('id', editRecord.id);
      }

      const { data: existing } = await dupQuery.maybeSingle();

      if (existing) {
        setErrorMsg(
          `Cannot save — ${selectedEquipment.no_id} was already inspected for ${monthYear} (${week}) by ${existing.inspector_name} on ${existing.inspection_date}. Each equipment can only be inspected once per week.`
        );
        setLoading(false);
        return;
      }

      // 1. Upload photos to Supabase Storage `inspection_photos`
      let uploadedEquipmentPhotoUrl = equipmentPhotoUrl;
      if (equipmentPhotoUrl.startsWith('data:image')) {
        const response = await fetch(equipmentPhotoUrl);
        const blob = await response.blob();
        const fileName = `inspection_eq_${selectedEquipment.no_id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('inspection_photos')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw new Error(`Equipment photo upload failed: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage
          .from('inspection_photos')
          .getPublicUrl(uploadData.path);
        uploadedEquipmentPhotoUrl = publicUrlData.publicUrl;
      }

      let uploadedChecklistPhotoUrl = checklistPhotoUrl;
      if (checklistPhotoUrl.startsWith('data:image')) {
        const response = await fetch(checklistPhotoUrl);
        const blob = await response.blob();
        const fileName = `inspection_cl_${selectedEquipment.no_id}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('inspection_photos')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw new Error(`Checklist photo upload failed: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage
          .from('inspection_photos')
          .getPublicUrl(uploadData.path);
        uploadedChecklistPhotoUrl = publicUrlData.publicUrl;
      }

      // 2. Save record into `public.inspections` table (Insert or Update)
      const payload = {
        equipment_id: selectedEquipment.id,
        equipment_no_id: selectedEquipment.no_id,
        equipment_type: selectedEquipment.type,
        inspector_name: inspectorName,
        inspection_date: inspectionDate,
        week,
        month_year: monthYear,
        answers,
        status: computedStatus,
        photo_url: `${uploadedEquipmentPhotoUrl},${uploadedChecklistPhotoUrl}`,
        remarks: remarks.trim() || null,
        action_taken: actionTaken.trim() || null,
      };

      if (editRecord?.id) {
        const { error: dbError } = await supabase
          .from('inspections')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editRecord.id);

        if (dbError) throw new Error(`Failed to update inspection log: ${dbError.message}`);
      } else {
        const { error: dbError } = await supabase.from('inspections').insert(payload);

        if (dbError) throw new Error(`Failed to save inspection: ${dbError.message}`);
      }

      setLoading(false);
      onSuccess();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="rounded-2xl border p-4 text-sm flex items-start gap-3 animate-fade tone-rose">
          <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>{errorMsg}</div>
        </div>
      )}

      {selectedEquipment && duplicate && (
        <div className="rounded-2xl border p-4 text-sm flex items-start gap-3 animate-fade tone-amber">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="font-semibold">Already inspected this period</p>
            <p className="text-xs mt-0.5 text-amber-400/90">
              {selectedEquipment.no_id} was already inspected for <span className="font-semibold">{monthYear} ({week})</span> by{' '}
              <span className="font-semibold">{duplicate.inspector}</span> on <span className="font-semibold">{duplicate.date}</span>.
              Duplicate inspections are not allowed — change the equipment or the inspection date.
            </p>
          </div>
        </div>
      )}

      {/* Weekly coverage progress vs the masterlist */}
      <div className="panel p-5 flex flex-col md:flex-row md:items-center gap-4 border-ember-900/40">
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ember-600/15 text-ember-400 border border-ember-900/50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-bold text-ink-100">Weekly Inspection Coverage</p>
            <p className="text-[11px] text-ink-500">
              {monthYear ? `${monthYear} · ${week}` : 'Auto-calculated from the inspection date'}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between text-xs text-ink-300 mb-1.5 gap-3">
            <span>
              <strong className="text-ink-100">{inspectedCoverage}</strong> / {totalCoverage} masterlist equipment inspected
            </span>
            <span className={`font-semibold shrink-0 ${remainingCoverage > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {remainingCoverage > 0 ? `${remainingCoverage} remaining this week` : '✓ Week complete'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${remainingCoverage > 0 ? 'bg-ember-500' : 'bg-emerald-500'}`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step 1: Filter & Select Masterlist Equipment */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-ember-600/20 text-ember-400 border border-ember-900/50 flex items-center justify-center text-xs">1</span>
              Select Equipment from Masterlist
            </h3>
            <p className="text-xs text-ink-400 mt-0.5">Filter by Factory, Equipment Type, or search ID.</p>
          </div>
          {selectedEquipment && (
            <button
              type="button"
              onClick={() => applyEquipmentSelection(null)}
              className="text-xs text-ember-400 hover:text-ember-500 underline"
            >
              Change Selection
            </button>
          )}
        </div>

        {!selectedEquipment ? (
          <div className="space-y-4">
            {/* Facility: auto-detected from the logged-in account, otherwise admin fallback */}
            {userFacility ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-2.5 text-xs text-ink-200">
                <svg className="shrink-0 text-ember-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>
                  Facility detected from your account:{' '}
                  <strong className="text-ember-300">{selectedFacility}</strong>
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label text-xs">Filter by Factory / Facility</label>
                  <select
                    value={selectedFacility}
                    onChange={(e) => setSelectedFacility(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="All">All Factories / Facilities</option>
                    {uniqueFacilities.map((fac) => (
                      <option key={fac} value={fac}>{fac}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Equipment Type icon filter */}
            <div>
              <label className="field-label text-xs">Filter by Equipment Type</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('All')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    selectedTypeFilter === 'All'
                      ? 'bg-ember-600/20 text-ember-300 border-ember-500/50'
                      : 'bg-ink-900/60 text-ink-400 border-line hover:bg-ink-800'
                  }`}
                >
                  All
                </button>
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSelectedTypeFilter(t.value)}
                    title={`Filter by ${t.label}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      selectedTypeFilter === t.value
                        ? 'bg-ember-600/20 text-ember-300 border-ember-500/50'
                        : 'bg-ink-900/60 text-ink-400 border-line hover:bg-ink-800'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Equipment ID (e.g. D3-001, B1-001) or location..."
                  className="input pl-10 text-xs"
                />
                <svg
                  className="absolute left-3.5 top-3.5 w-4 h-4 text-ink-500"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQrError(null);
                  setShowQrScanner(true);
                }}
                className="btn btn-primary shrink-0 px-4 py-2.5 text-xs flex items-center gap-2"
                title="Scan the equipment ID tag QR code to auto-select"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                  <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
                </svg>
                Scan QR
              </button>
            </div>

            {qrError && (
              <div className="rounded-xl border p-3 text-xs leading-relaxed tone-rose">
                {qrError}
              </div>
            )}

            {fetchingData ? (
              <div className="py-8 text-center text-xs text-ink-500 animate-pulse">
                Loading masterlist items...
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-line rounded-xl border border-line bg-ink-950/60">
                {filteredEquipment.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectEquipment(item)}
                    className="w-full text-left p-3.5 hover:bg-ink-800/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink-100 text-sm">{item.no_id}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-ink-800 border border-line text-ink-300">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 mt-1">
                        <span className="text-ember-400 font-medium">{item.facility}</span> • {item.area} ({item.location})
                      </p>
                    </div>
                    <span className="text-xs text-ember-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                      Select →
                    </span>
                  </button>
                ))}
                {filteredEquipment.length === 0 && (
                  <div className="py-8 text-center text-xs text-ink-500">
                    No equipment found matching current factory/type filter.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Selected Equipment Card */
          <div className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-ink-100 tracking-tight">{selectedEquipment.no_id}</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border tone-ember">
                  {selectedEquipment.type}
                </span>
              </div>
              <p className="text-sm text-ink-300 mt-1">
                <span className="font-medium text-ember-400">{selectedEquipment.facility}</span> — {selectedEquipment.area} ({selectedEquipment.location})
              </p>
              {selectedEquipment.pic_1?.name && (
                <p className="text-xs text-ink-400 mt-1">
                  Assigned PIC: <span className="text-ink-200 font-medium">{selectedEquipment.pic_1.name}</span>
                </p>
              )}
            </div>

            <div className="text-xs text-ink-400 bg-ink-900/60 p-3 rounded-xl border border-line max-w-xs">
              <span className="block font-semibold text-ink-200 mb-0.5">Assigned Form Template</span>
              <span className="text-ember-400 font-mono text-[11px]">{checklist?.docNo}</span>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Dynamic Checklist Questions */}
      {selectedEquipment && checklist && (
        <div className="panel p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h3 className="text-base font-semibold text-ink-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-ember-600/20 text-ember-400 border border-ember-900/50 flex items-center justify-center text-xs">2</span>
                Inspection Questions
              </h3>
              <p className="text-xs text-ink-400 mt-0.5">
                Select condition for each item. Items marked <span className="text-emerald-400 font-semibold">(Normal)</span> indicate a passing state.
              </p>
            </div>

            <button
              type="button"
              onClick={handleMarkAllNormal}
              className="btn btn-ghost text-xs bg-ink-800 text-ink-200 border border-line hover:bg-ink-700"
            >
              ✓ Mark All as Normal (Pass)
            </button>
          </div>

          <div className="space-y-6">
            {checklist.sections.map((section, sIndex) => (
              <div key={sIndex} className="space-y-3">
                <div className="bg-ink-900/80 px-4 py-2 rounded-xl border border-line">
                  <h4 className="text-xs font-bold text-ink-200 uppercase tracking-wider">{section.titleId}</h4>
                  <p className="text-[11px] text-sky-400 italic">{section.titleEn}</p>
                </div>

                <div className="divide-y divide-line/60 rounded-2xl border border-line bg-ink-950/40 overflow-hidden">
                  {section.items.map((item) => {
                    const currentVal = answers[item.id];
                    const expected = item.expectedAnswer || 'YES';
                    const isYesNormal = expected === 'YES';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          item.isIndent ? 'pl-8 bg-white/[0.01]' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm text-ink-100 font-medium">{item.labelId}</p>
                          <p className="text-xs text-sky-400/80 italic">{item.labelEn}</p>
                        </div>

                        {/* Yes / No Toggle Buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {/* YES Button */}
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(item.id, 'YES')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                              currentVal === 'YES'
                                ? isYesNormal
                                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                                  : 'bg-rose-600/20 text-rose-400 border-rose-500/50 shadow-md shadow-rose-950/40'
                                : 'bg-ink-900/60 text-ink-400 border-line hover:bg-ink-800'
                            }`}
                          >
                            <span>{isYesNormal ? '✓' : '✕'}</span> YA / YES {isYesNormal ? '(Normal)' : '(Defect)'}
                          </button>

                          {/* NO Button */}
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(item.id, 'NO')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                              currentVal === 'NO'
                                ? !isYesNormal
                                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                                  : 'bg-rose-600/20 text-rose-400 border-rose-500/50 shadow-md shadow-rose-950/40'
                                : 'bg-ink-900/60 text-ink-400 border-line hover:bg-ink-800'
                            }`}
                          >
                            <span>{!isYesNormal ? '✓' : '✕'}</span> TIDAK / NO {!isYesNormal ? '(Normal)' : '(Defect)'}
                          </button>

                          {/* NA Button (only for items that allow "Not Applicable", e.g. Emergency Lamp without an exit lamp) */}
                          {item.allowNA && (
                            <button
                              type="button"
                              onClick={() => handleAnswerChange(item.id, 'NA')}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                                currentVal === 'NA'
                                  ? 'bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-md shadow-sky-950/40'
                                  : 'bg-ink-900/60 text-ink-400 border-line hover:bg-ink-800'
                              }`}
                              title="Tidak memiliki komponen ini / Not Applicable"
                            >
                              <span>—</span> TIDAK ADA / N/A
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Mandatory Live Camera Photo Verification */}
      {selectedEquipment && (
        <div className="panel p-6 space-y-4">
          <h3 className="text-base font-semibold text-ink-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-ember-600/20 text-ember-400 border border-ember-900/50 flex items-center justify-center text-xs">3</span>
            Equipment Photo Verification (Live Camera Only)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CameraCapture
              photoUrl={equipmentPhotoUrl}
              onPhotoCaptured={(url) => setEquipmentPhotoUrl(url)}
              onPhotoCleared={() => setEquipmentPhotoUrl(null)}
              title="Equipment Unit Photo"
              description="Photo must be taken live on-site with your device camera to ensure authenticity."
            />
            <CameraCapture
              photoUrl={checklistPhotoUrl}
              onPhotoCaptured={(url) => setChecklistPhotoUrl(url)}
              onPhotoCleared={() => setChecklistPhotoUrl(null)}
              title="Printed Checklist Form Photo"
              description="Please capture a clear photo of the printed checklist form that you have filled out."
            />
          </div>
        </div>
      )}

      {/* Step 4: Inspector & Auto-Calculated Dates */}
      {selectedEquipment && (
        <div className="panel p-6 space-y-6">
          <h3 className="text-base font-semibold text-ink-100 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-ember-600/20 text-ember-400 border border-ember-900/50 flex items-center justify-center text-xs">4</span>
            Inspector Selection & Inspection Period
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inspector Name Select from PIC Masterlist */}
            <div>
              <label className="field-label">
                Inspector Name (Select from PIC Masterlist)
              </label>
              <select
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="input"
                required
                disabled={isLockedInspector}
              >
                <option value="" disabled>Select Inspector PIC...</option>
                {picList.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              {isLockedInspector && (
                <p className="text-[10px] text-ember-400 mt-1">
                  Name is locked to your account.
                </p>
              )}
            </div>

            {/* Inspection Date */}
            <div>
              <label className="field-label">Inspection Date</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="input"
                required
              />
            </div>

            {/* Auto Calculated Week */}
            <div>
              <label className="field-label text-ink-300 flex items-center justify-between">
                <span>Week (Auto-calculated)</span>
                <span className="text-[10px] text-ember-400 font-mono">Auto</span>
              </label>
              <input
                type="text"
                value={week}
                readOnly
                className="input bg-ink-950/80 text-ink-200 cursor-not-allowed border-line/60 font-semibold"
              />
            </div>

            {/* Auto Calculated Month / Year */}
            <div>
              <label className="field-label text-ink-300 flex items-center justify-between">
                <span>Month / Year (Auto-calculated)</span>
                <span className="text-[10px] text-ember-400 font-mono">Auto</span>
              </label>
              <input
                type="text"
                value={monthYear}
                readOnly
                className="input bg-ink-950/80 text-ink-200 cursor-not-allowed border-line/60 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Remarks (Keterangan)</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Optional notes or observed condition details..."
              />
            </div>

            <div>
              <label className="field-label">Action Taken (Tindakan)</label>
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Action taken if any defects or issues were found..."
              />
            </div>
          </div>

          {/* Live Calculated Outcome */}
          <div className="rounded-xl border border-line bg-ink-950/60 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-auto text-center md:text-left">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Calculated Result</p>
              <div className="flex items-center gap-2 mt-1">
                {computedStatus === 'PASS' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold">
                    <span>✓</span> PASS / NORMAL
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold">
                    <span>⚠️</span> NEEDS ATTENTION / DEFECTIVE
                  </span>
                )}
                <span className="text-xs text-ink-400">({answeredCount}/{totalQuestions} questions answered)</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="btn btn-ghost text-xs w-full md:w-auto mb-2 md:mb-0"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !equipmentPhotoUrl || !checklistPhotoUrl || !!duplicate || checkingDuplicate}
                className="btn btn-primary text-xs px-6 py-2.5 flex items-center justify-center gap-2 w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting...
                  </>
                ) : !equipmentPhotoUrl || !checklistPhotoUrl ? (
                  'Complete & Save Inspection'
                ) : duplicate ? (
                  'Already Inspected — Save Blocked'
                ) : (
                  'Complete & Save Inspection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrScanner && (
        <QRScannerModal
          onScan={handleQrScan}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </form>
  );
}
