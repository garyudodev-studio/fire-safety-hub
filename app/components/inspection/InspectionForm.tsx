'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getChecklistForType, EquipmentChecklist } from '@/app/lib/inspectionChecklists';
import CameraCapture from './CameraCapture';

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

interface InspectionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InspectionForm({ onSuccess, onCancel }: InspectionFormProps) {
  const [masterlist, setMasterlist] = useState<EquipmentItem[]>([]);
  const [picList, setPicList] = useState<PicItem[]>([]);

  // Selection & Filter states
  const [selectedFacility, setSelectedFacility] = useState<string>('All');
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

      if (eqData) setMasterlist(eqData as unknown as EquipmentItem[]);

      // Fetch PICs
      const { data: picsData } = await supabase
        .from('pic')
        .select('id, name, phone, signature_url')
        .order('name', { ascending: true });

      // Fetch current user role and pic
      const { data: sessionData } = await supabase.auth.getSession();
      let lockedName = null;
      if (sessionData?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, pic:pic_id(name)')
          .eq('id', sessionData.session.user.id)
          .single();
          
        if (profile?.role === 'inspector' && profile.pic?.name) {
          lockedName = profile.pic.name;
          setIsLockedInspector(true);
          setInspectorName(lockedName);
        }
      }

      if (picsData && picsData.length > 0 && !lockedName) {
        setPicList(picsData as PicItem[]);
        setInspectorName(picsData[0].name); // default first PIC
      } else if (picsData) {
        setPicList(picsData as PicItem[]);
      }

      setFetchingData(false);
    };

    loadData();
  }, [supabase]);

  // Detect if the selected equipment was already inspected in the same month + week
  useEffect(() => {
    if (!selectedEquipment || !monthYear || !week) return;

    let cancelled = false;
    const checkDuplicate = async () => {
      setCheckingDuplicate(true);
      setDuplicate(null);
      const { data } = await supabase
        .from('inspections')
        .select('inspector_name, inspection_date')
        .eq('equipment_id', selectedEquipment.id)
        .eq('month_year', monthYear)
        .eq('week', week)
        .maybeSingle();
      if (!cancelled) {
        if (data) setDuplicate({ inspector: data.inspector_name, date: data.inspection_date });
        setCheckingDuplicate(false);
      }
    };

    checkDuplicate();
    return () => { cancelled = true; };
  }, [selectedEquipment, week, monthYear, supabase]);

  // Unique list of facilities/factories for filter dropdown
  const uniqueFacilities = Array.from(
    new Set(masterlist.map((e) => e.facility).filter(Boolean))
  ).sort();

  // Unique list of types for filter dropdown
  const uniqueTypes = Array.from(
    new Set(masterlist.map((e) => e.type).filter(Boolean))
  ).sort();

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
      const { data: existing } = await supabase
        .from('inspections')
        .select('inspector_name, inspection_date')
        .eq('equipment_id', selectedEquipment.id)
        .eq('month_year', monthYear)
        .eq('week', week)
        .maybeSingle();

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

      // 2. Insert record into `public.inspections` table
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

      const { error: dbError } = await supabase.from('inspections').insert(payload);

      if (dbError) {
        throw new Error(`Failed to save inspection: ${dbError.message}`);
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
            {/* Factory & Equipment Type Filters */}
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

              <div>
                <label className="field-label text-xs">Filter by Equipment Type</label>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="input text-xs"
                >
                  <option value="All">All Equipment Types</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
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
    </form>
  );
}
