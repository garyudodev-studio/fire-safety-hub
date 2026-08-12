'use client';

import { useEffect, useState, useRef } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { deleteStorageFiles } from '@/app/lib/storageHelpers';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { ConfirmModal, AlertModal, ConfirmState, AlertState } from '@/app/components/ui/CustomModal';
import ImageModal from '@/app/components/ui/ImageModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';

/* ---------- Icons (line style, inherit color) ---------- */
const Icon = ({ children, size = 16 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;
const UsersIcon = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" /></Icon>;
const ExportIcon = () => <Icon><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></Icon>;
const TemplateIcon = () => <Icon><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></Icon>;
const ImportIcon = () => <Icon><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>;
const PrintIcon = () => <Icon><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></Icon>;
const CloseIcon = () => <Icon size={20}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const SearchIcon = () => <Icon size={28}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>;
const CameraIcon = () => <Icon size={22}><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
const TrashIcon = () => <Icon><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icon>;
const EditIcon = () => <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>;
const ChevronDown = () => <Icon size={14}><path d="m6 9 6 6 6-6" /></Icon>;
const GridIcon = () => <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>;
const ListIcon = () => <Icon><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>;

const initialFormData = {
    no_id: '',
    type: 'Fire Alarm',
    entity: '',
    facility: '',
    area: '',
    location: '',
    zone: '',
    placement: '',
    extinguisher_type: '',
    weight_kg: '',
    start_date: '',
    expire_date: '',
    pic_1_id: '',
    pic_2_id: '',
    pic_1_photo: '',
    pic_2_photo: '',
};

type ViewMode = 'grid' | 'list';

type Pic = {
    id: string;
    name: string;
    phone?: string | null;
    image_profile?: string | null;
    image_contact?: string | null;
};

type Equipment = {
    id: string;
    no_id: string | null;
    type: string;
    entity?: string | null;
    facility?: string | null;
    area?: string | null;
    location?: string | null;
    zone?: string | null;
    placement?: string | null;
    extinguisher_type?: string | null;
    weight_kg?: string | null;
    start_date?: string | null;
    expire_date?: string | null;
    pic_1_id?: string | null;
    pic_2_id?: string | null;
    pic_1_photo?: string | null;
    pic_2_photo?: string | null;
    pic_1?: Pic | null;
    pic_2?: Pic | null;
};

function getFormTemplate(type: string): string {
    switch (type) {
        case 'Fire Alarm': return '/form_checklist/form checklist_fire alarm.html';
        case 'Fire Hydrant': return '/form_checklist/form checklist_fire hydrant.html';
        case 'Fire Extinguisher': return '/form_checklist/form checklist_fire extinguishers.html';
        case 'Emergency Lamp': return '/form_checklist/form checklist_emergency lamp.html';
        default: return '/form_checklist/form checklist_fire alarm.html';
    }
}

function getTypeBadgeColor(type: string): string {
    switch (type) {
        case 'Fire Alarm': return 'tone-ember';
        case 'Fire Hydrant': return 'tone-sky';
        case 'Fire Extinguisher': return 'tone-orange';
        case 'Emergency Lamp': return 'tone-amber';
        default: return 'bg-white/[0.04] text-ink-300 border-line';
    }
}

export default function AdminDashboard() {
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [pics, setPics] = useState<Pic[]>([]);
    const [loading, setLoading] = useState(true);
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    // Modal States
    const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
    const [alertModal, setAlertModal] = useState<AlertState | null>(null);
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterEntity, setFilterEntity] = useState('');
    const [filterFacility, setFilterFacility] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterArea, setFilterArea] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [prevFilterSignature, setPrevFilterSignature] = useState(
        [searchQuery, filterEntity, filterFacility, filterType, filterArea].join('|')
    );
    const itemsPerPage = 10;

    // UI State for Side/Bottom Sheet
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Equipment | null>(null);
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Photo upload state
    const [uploadingPhoto, setUploadingPhoto] = useState<{ id: string; slot: 'pic_1_photo' | 'pic_2_photo' } | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkPic1, setBulkPic1] = useState('');
    const [bulkPic2, setBulkPic2] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inlinePhotoInputRef = useRef<HTMLInputElement>(null);
    const pendingUploadRef = useRef<{ id: string; slot: 'pic_1_photo' | 'pic_2_photo' } | null>(null);

    const supabase = getSupabaseClient();
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/');
                return;
            }

            setLoading(true);
            const { data, error } = await supabase
                .from('equipment')
                .select('*, pic_1:pic_1_id(id, name, phone, image_profile, image_contact), pic_2:pic_2_id(id, name, phone, image_profile, image_contact)')
                .order('no_id', { ascending: true });
            if (!cancelled && !error && data) setEquipment(data);

            const { data: picsData } = await supabase.from('pic').select('id, name, phone, image_profile, image_contact');
            if (!cancelled && picsData) setPics(picsData);

            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!cancelled && currentSession?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, entity, facility, pic:pic_id(entity, facility)')
                    .eq('id', currentSession.user.id)
                    .single();

                if (profile) {
                    const assignedEntity = profile.entity || (profile.pic as { entity?: string | null })?.entity;
                    const assignedFacility = profile.facility || (profile.pic as { facility?: string | null })?.facility;
                    if (assignedEntity) setFilterEntity(assignedEntity);
                    if (assignedFacility) setFilterFacility(assignedFacility);
                }
            }

            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [supabase, router, reloadTrigger]);

    // --- Derived filter options ---
    const uniqueEntities = Array.from(new Set(equipment.map(e => e.entity).filter(Boolean))).sort();
    const uniqueFacilities = Array.from(new Set(equipment.map(e => e.facility).filter(Boolean))).sort();
    const uniqueTypes = Array.from(new Set(equipment.map(e => e.type).filter(Boolean))).sort();
    const uniqueAreas = Array.from(new Set(equipment.map(e => e.area).filter(Boolean))).sort();

    // --- Fire Extinguisher Expiry Monitoring ---
    const today = new Date(); today.setHours(0,0,0,0);
    const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30);
    const expiringExtinguishers = equipment.filter(item => {
        if (item.type !== 'Fire Extinguisher' || !item.expire_date) return false;
        const exp = new Date(item.expire_date); exp.setHours(0,0,0,0);
        return exp <= in30Days;
    }).map(item => {
        const exp = new Date(item.expire_date!); exp.setHours(0,0,0,0);
        const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
        return { ...item, daysLeft, expired: daysLeft < 0 };
    }).sort((a,b) => a.daysLeft - b.daysLeft);

    const getExpiryStatus = (item: Equipment): { label: string; cls: string } | null => {
        if (item.type !== 'Fire Extinguisher' || !item.expire_date) return null;
        const exp = new Date(item.expire_date); exp.setHours(0,0,0,0);
        const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
        if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, cls: 'tone-rose' };
        if (days === 0) return { label: 'Expires today!', cls: 'tone-rose' };
        if (days <= 7)  return { label: `Expires in ${days}d`, cls: 'tone-rose' };
        if (days <= 30) return { label: `Expires in ${days}d`, cls: 'tone-amber' };
        return null;
    };

    // --- Filtered data ---
    const filteredEquipment = equipment.filter(item => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const idMatch = item.no_id?.toLowerCase().includes(q);
            const pic1Match = item.pic_1?.name?.toLowerCase().includes(q);
            const pic2Match = item.pic_2?.name?.toLowerCase().includes(q);
            if (!idMatch && !pic1Match && !pic2Match) return false;
        }
        if (filterEntity && item.entity !== filterEntity) return false;
        if (filterFacility && item.facility !== filterFacility) return false;
        if (filterType && item.type !== filterType) return false;
        if (filterArea && item.area !== filterArea) return false;
        return true;
    });

    const totalPages = Math.ceil(filteredEquipment.length / itemsPerPage);
    const paginatedEquipment = filteredEquipment.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const filterSignature = [searchQuery, filterEntity, filterFacility, filterType, filterArea].join('|');
    if (filterSignature !== prevFilterSignature) {
        setPrevFilterSignature(filterSignature);
        setCurrentPage(1);
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    // --- CRUD Actions ---

    const openCreateSheet = () => {
        setEditingItem(null);
        setFormData(initialFormData);
        setIsSheetOpen(true);
    };

    const openEditSheet = (item: Equipment) => {
        setEditingItem(item);
        setFormData({
            no_id: item.no_id || '',
            type: item.type || 'Fire Alarm',
            entity: item.entity || '',
            facility: item.facility || '',
            area: item.area || '',
            location: item.location || '',
            zone: item.zone || '',
            placement: item.placement || '',
            extinguisher_type: item.extinguisher_type || '',
            weight_kg: item.weight_kg || '',
            start_date: item.start_date || '',
            expire_date: item.expire_date || '',
            pic_1_id: item.pic_1_id || '',
            pic_2_id: item.pic_2_id || '',
            pic_1_photo: item.pic_1_photo || '',
            pic_2_photo: item.pic_2_photo || '',
        });
        setIsSheetOpen(true);
    };

    const closeSheet = () => {
        setIsSheetOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const payload: Record<string, unknown> = { ...formData };
        if (!payload.zone) payload.zone = null;
        if (!payload.placement) payload.placement = null;
        if (!payload.extinguisher_type) payload.extinguisher_type = null;
        if (!payload.weight_kg) payload.weight_kg = null;
        if (!payload.start_date) payload.start_date = null;
        if (!payload.expire_date) payload.expire_date = null;
        if (!payload.pic_1_id) payload.pic_1_id = null;
        if (!payload.pic_2_id) payload.pic_2_id = null;
        if (!payload.pic_1_photo) payload.pic_1_photo = null;
        if (!payload.pic_2_photo) payload.pic_2_photo = null;

        payload.updated_at = new Date().toISOString();

        let error;
        if (editingItem?.id) {
            const { error: updateError } = await supabase.from('equipment').update(payload).eq('id', editingItem.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('equipment').insert(payload);
            error = insertError;
        }

        setIsSaving(false);
        if (!error) {
            closeSheet();
            setReloadTrigger(t => t + 1);
        } else {
            setAlertModal({ isOpen: true, title: 'Save Error', message: error.message, type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Equipment',
            message: 'Are you sure you want to delete this equipment? All associated storage photos and inspection logs will also be removed.',
            variant: 'danger',
            onConfirm: async () => {
                // 1. Find equipment & its photos
                const targetEq = equipment.find(e => e.id === id);
                if (targetEq) {
                    await deleteStorageFiles(supabase, 'equipment_photos', [targetEq.pic_1_photo, targetEq.pic_2_photo]);
                    
                    // List any extra files stored in folder `{id}/` in equipment_photos
                    const { data: folderFiles } = await supabase.storage.from('equipment_photos').list(id);
                    if (folderFiles && folderFiles.length > 0) {
                        const folderPaths = folderFiles.map((f: { name: string }) => `${id}/${f.name}`);
                        await supabase.storage.from('equipment_photos').remove(folderPaths);
                    }
                }

                // 2. Find and delete photos from related inspection logs
                const { data: relatedInspections } = await supabase.from('inspections').select('photo_url').eq('equipment_id', id);
                if (relatedInspections && relatedInspections.length > 0) {
                    const inspUrls = relatedInspections.map((i: { photo_url: string | null }) => i.photo_url);
                    await deleteStorageFiles(supabase, 'inspection_photos', inspUrls);
                    await supabase.from('inspections').delete().eq('equipment_id', id);
                }

                // 3. Delete the equipment record
                const { error } = await supabase.from('equipment').delete().eq('id', id);
                if (!error) {
                    setReloadTrigger(t => t + 1);
                } else {
                    setAlertModal({ isOpen: true, title: 'Error', message: error.message, type: 'error' });
                }
            }
        });
    };

    // --- Photo Upload ---

    const uploadPhotoToStorage = async (file: File, id: string, slot: 'pic_1_photo' | 'pic_2_photo') => {
        const ext = file.name.split('.').pop();
        const path = `${id}/${slot}_${Date.now()}.${ext}`; // add timestamp to avoid caching issues

        // Check for existing photo and delete it
        const { data: oldEq } = await supabase.from('equipment').select(slot).eq('id', id).single();
        if (oldEq && oldEq[slot]) {
            const oldUrl = oldEq[slot] as string;
            const oldFilename = oldUrl.split('/').pop();
            if (oldFilename) {
                await supabase.storage.from('equipment_photos').remove([`${id}/${oldFilename}`]);
            }
        }

        // Upload to Supabase Storage bucket named 'equipment_photos'
        const { error } = await supabase.storage
            .from('equipment_photos')
            .upload(path, file, { upsert: true });

        if (error) {
            console.error('Error uploading photo:', error);
            setAlertModal({ isOpen: true, title: 'Upload Failed', message: 'Failed to upload photo.', type: 'error' });
            return null;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('equipment_photos')
            .getPublicUrl(path);

        const url = publicUrlData.publicUrl;

        // Update database record with photo URL
        const { error: dbError } = await supabase.from('equipment')
            .update({ [slot]: url, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (dbError) {
            setAlertModal({ isOpen: true, title: 'DB Update Error', message: `DB update failed: ${dbError.message}`, type: 'error' });
            return;
        }

        setReloadTrigger(t => t + 1);
    };

    const handleInlinePicChange = async (id: string, field: 'pic_1_id' | 'pic_2_id', value: string) => {
        const val = value === '' ? null : value;
        const { error } = await supabase.from('equipment').update({ [field]: val, updated_at: new Date().toISOString() }).eq('id', id);
        if (!error) setReloadTrigger(t => t + 1);
        else setAlertModal({ isOpen: true, title: 'Error', message: `Failed to assign PIC: ${error.message}`, type: 'error' });
    };

    const handleInlinePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !pendingUploadRef.current) return;
        const { id, slot } = pendingUploadRef.current;
        setUploadingPhoto({ id, slot });
        await uploadPhotoToStorage(file, id, slot);
        setReloadTrigger(t => t + 1);
        setUploadingPhoto(null);
        pendingUploadRef.current = null;
        if (inlinePhotoInputRef.current) inlinePhotoInputRef.current.value = '';
    };

    const handleFormPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: 'pic_1_photo' | 'pic_2_photo') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (editingItem?.id) {
            setUploadingPhoto({ id: editingItem.id, slot });
            await uploadPhotoToStorage(file, editingItem.id, slot);
            setUploadingPhoto(null);
            // Refresh form data from latest equipment
            const { data } = await supabase.from('equipment').select('pic_1_photo, pic_2_photo').eq('id', editingItem.id).single();
            if (data) setFormData(prev => ({ ...prev, [slot]: data[slot] || '' }));
        } else {
            // Not yet saved — preview only via object URL
            const localUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, [slot]: localUrl }));
        }
    };

    // --- Print Checklist ---

    const generatePrintHTML = async (items: Equipment[]) => {
        if (items.length === 0) return;

        let finalHtml = '';
        let baseHeader = '';
        const baseFooter = `
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body></html>`;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const templatePath = getFormTemplate(item.type);

            const res = await fetch(templatePath);
            const html = await res.text();

            if (i === 0) {
                const bodyMatch = html.match(/([\s\S]*?<body[^>]*>)/);
                if (bodyMatch) {
                    baseHeader = bodyMatch[1];
                }
            }

            const containerMatch = html.match(/(<div class="a4-container">[\s\S]*?<\/div>)\s*<\/body>/);
            let containerHtml = containerMatch ? containerMatch[1] : html;

            const idValue = item.no_id || '';
            const areaValue = item.area || '';
            const locationValue = item.location || '';

            containerHtml = containerHtml.replace(/: D3-001/, `: ${idValue}`);
            containerHtml = containerHtml.replace(/: B1-001/, `: ${idValue}`);
            containerHtml = containerHtml.replace(/: OFFICE(?=<)/, `: ${areaValue}`);
            containerHtml = containerHtml.replace(/: AREA LUAR/, `: ${areaValue}`);
            containerHtml = containerHtml.replace(/: OFFICE LT 3/, `: ${locationValue}`);
            containerHtml = containerHtml.replace(/: PINTU EMERGENCY LT 3/, `: ${locationValue}`);
            containerHtml = containerHtml.replace(/: GATE LOBBY/, `: ${locationValue}`);

            const pic1Name = item.pic_1?.name || '';
            const pic1Phone = item.pic_1?.phone || '';
            const pic1Photo = item.pic_1?.image_profile || item.pic_1_photo || '';
            const pic1Contact = item.pic_1?.image_contact || '';

            const pic2Name = item.pic_2?.name || '';
            const pic2Phone = item.pic_2?.phone || '';
            const pic2Photo = item.pic_2?.image_profile || item.pic_2_photo || '';
            const pic2Contact = item.pic_2?.image_contact || '';

            containerHtml = containerHtml.replace(/Regiana Respatyansah/, pic1Name || 'PIC 1');
            containerHtml = containerHtml.replace(/Karyono/, pic2Name || 'PIC 2');
            containerHtml = containerHtml.replace(/Regiana(?=<)/, pic1Name || 'PIC 1');

            containerHtml = containerHtml.replace(/082311547440/, pic1Phone || '-');
            containerHtml = containerHtml.replace(/081585137154/, pic2Phone || '-');

            if (pic1Photo) {
                containerHtml = containerHtml.replace(
                    /<div class="photo">FOTO PIC<\/div>/,
                    `<div class="photo" style="background:white;padding:0;height:auto;border-bottom:1px solid black;"><img src="${pic1Photo}" style="width:100%;height:auto;display:block;" /></div>`
                );
            }
            if (pic2Photo) {
                containerHtml = containerHtml.replace(
                    /<div class="photo">FOTO PIC<\/div>/,
                    `<div class="photo" style="background:white;padding:0;height:auto;border-bottom:1px solid black;"><img src="${pic2Photo}" style="width:100%;height:auto;display:block;" /></div>`
                );
            }

            if (pic1Contact) {
                containerHtml = containerHtml.replace(
                    /<div class="qr-placeholder"><\/div>/,
                    `<div class="qr-placeholder" style="background:white;border:none;height:auto;width:100%;max-width:60px;margin:0 auto;"><img src="${pic1Contact}" style="width:100%;height:auto;display:block;" /></div>`
                );
            } else {
                containerHtml = containerHtml.replace(/<div class="qr-placeholder"><\/div>/, '<div class="qr-placeholder" style="background:none;"></div>');
            }

            if (pic2Contact) {
                containerHtml = containerHtml.replace(
                    /<div class="qr-placeholder"><\/div>/,
                    `<div class="qr-placeholder" style="background:white;border:none;height:auto;width:100%;max-width:60px;margin:0 auto;"><img src="${pic2Contact}" style="width:100%;height:auto;display:block;" /></div>`
                );
            } else {
                containerHtml = containerHtml.replace(/<div class="qr-placeholder"><\/div>/, '<div class="qr-placeholder" style="background:none;"></div>');
            }

            containerHtml = containerHtml.replace(
                /<div class="logo-circle">[\s\S]*?<\/div>/,
                `<div class="logo-circle" style="background:none;"><img src="/logoyj.jpeg" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" /></div>`
            );

            if (i < items.length - 1) {
                containerHtml = `<div style="page-break-after: always; break-after: page;">${containerHtml}</div>`;
            } else {
                containerHtml = `<div>${containerHtml}</div>`;
            }

            finalHtml += containerHtml;
        }

        baseHeader = baseHeader.replace('</head>', `
        <style>
            @media print {
                @page { size: A4 portrait; margin: 0; }
                body { margin: 0; padding: 0; display: block !important; background: white !important; }
                .a4-container { box-shadow: none !important; margin: 0 auto !important; padding: 10mm !important; }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        </style>
        </head>`);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(baseHeader + finalHtml + baseFooter);
            printWindow.document.close();
        }
    };

    const handlePrint = async (item: Equipment) => {
        try {
            await generatePrintHTML([item]);
        } catch {
            setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to load checklist template.', type: 'error' });
        }
    };

    const handlePrintFiltered = async () => {
        if (filteredEquipment.length === 0) return;
        try {
            await generatePrintHTML(filteredEquipment);
        } catch {
            setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to load checklist templates.', type: 'error' });
        }
    };

    // --- Excel Upload Functions ---

    const downloadTemplate = () => {
        const headers = [
            'ID', 'Type', 'Entity', 'Facility', 'Area', 'Location',
            'Zone', 'Placement', 'Extinguisher Type', 'Weight (Kg)', 'Start Date', 'Expire Date', 'PIC 1', 'PIC 2'
        ];
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
        XLSX.writeFile(workbook, 'equipment_template.xlsx');
    };

    const handleExport = () => {
        const exportData = filteredEquipment.map(item => ({
            ID: item.no_id,
            Type: item.type,
            Entity: item.entity,
            Facility: item.facility,
            Area: item.area,
            Location: item.location,
            Zone: item.zone || '',
            Placement: item.placement || '',
            'Extinguisher Type': item.extinguisher_type || '',
            'Weight (Kg)': item.weight_kg || '',
            'Start Date': item.start_date || '',
            'Expire Date': item.expire_date || '',
            'PIC 1': item.pic_1?.name || '',
            'PIC 2': item.pic_2?.name || '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment Data');
        XLSX.writeFile(workbook, 'equipment_export.xlsx');
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === paginatedEquipment.length && paginatedEquipment.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedEquipment.map(e => e.id)));
        }
    };

    const handleBulkAssign = async (field: 'pic_1_id' | 'pic_2_id', picId: string) => {
        if (selectedIds.size === 0) return;
        setConfirmModal({
            isOpen: true,
            title: 'Bulk Assign PIC',
            message: `Are you sure you want to assign this PIC to ${selectedIds.size} items?`,
            variant: 'primary',
            onConfirm: async () => {
                const val = picId === '' ? null : picId;
                const ids = Array.from(selectedIds);

                const { error } = await supabase.from('equipment')
                    .update({ [field]: val, updated_at: new Date().toISOString() })
                    .in('id', ids);

                if (!error) {
                    setReloadTrigger(t => t + 1);
                    setSelectedIds(new Set());
                    if (field === 'pic_1_id') setBulkPic1('');
                    if (field === 'pic_2_id') setBulkPic2('');
                    setAlertModal({ isOpen: true, title: 'Success', message: 'Bulk assignment successful!', type: 'success' });
                } else {
                    setAlertModal({ isOpen: true, title: 'Error', message: `Failed to assign PIC: ${error.message}`, type: 'error' });
                }
            },
            onCancel: () => {
                if (field === 'pic_1_id') setBulkPic1('');
                if (field === 'pic_2_id') setBulkPic2('');
            }
        });
    };

    const triggerFileInput = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const worksheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[worksheetName];
                const rawData = XLSX.utils.sheet_to_json<Record<string, string | number | null | undefined>>(worksheet);

                const formattedData = rawData.map(row => {
                    const item: Record<string, unknown> = {};

                    const getPicId = (name: unknown) => {
                        if (!name) return null;
                        const found = pics.find(p => p.name.toLowerCase().trim() === String(name).toLowerCase().trim());
                        return found ? found.id : null;
                    };

                    item.no_id = row['ID'] !== undefined && row['ID'] !== '' ? String(row['ID']) : null;
                    item.type = row['Type'] !== undefined && row['Type'] !== '' ? String(row['Type']) : null;
                    item.entity = row['Entity'] !== undefined && row['Entity'] !== '' ? String(row['Entity']) : null;
                    item.facility = row['Facility'] !== undefined && row['Facility'] !== '' ? String(row['Facility']) : null;
                    item.area = row['Area'] !== undefined && row['Area'] !== '' ? String(row['Area']) : null;
                    item.location = row['Location'] !== undefined && row['Location'] !== '' ? String(row['Location']) : null;
                    item.zone = row['Zone'] !== undefined && row['Zone'] !== '' ? String(row['Zone']) : null;
                    item.placement = row['Placement'] !== undefined && row['Placement'] !== '' ? String(row['Placement']) : null;
                    item.extinguisher_type = row['Extinguisher Type'] !== undefined && row['Extinguisher Type'] !== '' ? String(row['Extinguisher Type']) : null;
                    item.weight_kg = row['Weight (Kg)'] !== undefined && row['Weight (Kg)'] !== '' ? parseFloat(String(row['Weight (Kg)'])) : null;
                    item.start_date = row['Start Date'] !== undefined && row['Start Date'] !== '' ? String(row['Start Date']) : null;
                    item.expire_date = row['Expire Date'] !== undefined && row['Expire Date'] !== '' ? String(row['Expire Date']) : null;
                    item.pic_1_id = getPicId(row['PIC 1']);
                    item.pic_2_id = getPicId(row['PIC 2']);

                    item.updated_at = new Date().toISOString();
                    return item;
                }).filter(row => row.no_id && row.type);

                if (formattedData.length > 0) {
                    const { error } = await supabase.from('equipment').insert(formattedData);
                    if (error) throw error;
                    setAlertModal({ isOpen: true, title: 'Import Complete', message: `Successfully imported ${formattedData.length} records!`, type: 'success' });
                    setReloadTrigger(t => t + 1);
                } else {
                    setAlertModal({ isOpen: true, title: 'Import Warning', message: 'No valid records found. Make sure no_id and type are provided.', type: 'info' });
                }
            } catch (err: unknown) {
                setAlertModal({ isOpen: true, title: 'Import Error', message: `Error parsing Excel file: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    useEffect(() => {
        if (!isSheetOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeSheet();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSheetOpen]);

    const activeFiltersCount = [filterEntity, filterFacility, filterType, filterArea].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-ink-950 text-ink-200 p-4 md:p-8">
            <div className="max-w-[1600px] mx-auto">

                {/* 🔴 Expiry Alert Banner */}
                {expiringExtinguishers.length > 0 && (
                    <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 animate-rise">
                        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-400">
                                {expiringExtinguishers.filter(e => e.expired).length > 0
                                    ? `⚠️ ${expiringExtinguishers.filter(e=>e.expired).length} Fire Extinguisher(s) EXPIRED — immediate replacement required`
                                    : `⏰ ${expiringExtinguishers.length} Fire Extinguisher(s) expiring within 30 days`
                                }
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {expiringExtinguishers.slice(0, 8).map(item => (
                                    <span key={item.id} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                                        item.expired ? 'tone-rose' : 'tone-amber'
                                    }`}>
                                        <span className="font-bold font-mono">{item.no_id}</span>
                                        <span className="text-[10px] opacity-75">{item.expired ? `expired ${Math.abs(item.daysLeft)}d ago` : `${item.daysLeft}d left`}</span>
                                    </span>
                                ))}
                                {expiringExtinguishers.length > 8 && (
                                    <span className="text-xs text-amber-500/70">+{expiringExtinguishers.length - 8} more</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <header className="panel flex flex-col gap-5 p-6 mb-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-600/15 text-ember-400 border border-ember-900/50">
                            <Icon size={22}><path d="M12 3 4 6v6c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-3Z" /></Icon>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Admin</p>
                            <h1 className="text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
                                Fire Safety Masterlist
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto mt-4 md:mt-0">
                        <Link href="/dashboard/pics" className="btn btn-ghost w-full sm:w-auto justify-center">
                            <UsersIcon /> Manage PICs
                        </Link>
                        <button onClick={handleExport} className="btn btn-soft">
                            <ExportIcon /> Export
                        </button>
                        <button onClick={downloadTemplate} className="btn btn-soft">
                            <TemplateIcon /> Template
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" className="hidden" />
                        <button onClick={triggerFileInput} disabled={isImporting} className="btn btn-soft disabled:opacity-50">
                            <ImportIcon /> {isImporting ? 'Importing…' : 'Import'}
                        </button>
                        <button onClick={openCreateSheet} className="btn btn-primary w-full sm:w-auto justify-center">
                            <PlusIcon /> Add Equipment
                        </button>
                        <button onClick={handleSignOut} className="btn btn-ghost w-full sm:w-auto justify-center" title="Sign out">
                            Sign out
                        </button>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="mb-6 flex flex-col gap-3">
                    {/* Filters — one row */}
                    <div className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:items-center">
                        <div className="relative w-full md:flex-[1.2] md:min-w-0">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
                                <SearchIcon />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by ID or PIC..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="input pl-10 w-full"
                            />
                        </div>
                        {[
                            { value: filterEntity, set: setFilterEntity, label: 'All Entities', options: uniqueEntities },
                            { value: filterFacility, set: setFilterFacility, label: 'All Facilities', options: uniqueFacilities },
                            { value: filterType, set: setFilterType, label: 'All Types', options: uniqueTypes },
                            { value: filterArea, set: setFilterArea, label: 'All Areas', options: uniqueAreas },
                        ].map((f, i) => (
                            <div key={i} className="relative w-full md:min-w-0 md:flex-1">
                                <select
                                    value={f.value}
                                    onChange={e => f.set(e.target.value)}
                                    className="select w-full"
                                >
                                    <option value="">{f.label}</option>
                                    {f.options.map(o => <option key={o as string} value={o as string}>{o as string}</option>)}
                                </select>
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                                    <ChevronDown />
                                </span>
                            </div>
                        ))}

                        {activeFiltersCount > 0 && (
                            <button
                                onClick={() => { setFilterEntity(''); setFilterFacility(''); setFilterType(''); setFilterArea(''); setSearchQuery(''); }}
                                className="btn btn-ghost px-3 py-2.5 text-xs w-full justify-center md:w-auto md:flex-none"
                            >
                                Clear
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink-300">{activeFiltersCount}</span>
                            </button>
                        )}

                        {filteredEquipment.length > 0 && filterType && (
                            <button
                                onClick={handlePrintFiltered}
                                className="btn btn-soft px-3 py-2.5 text-xs md:flex-none"
                            >
                                <PrintIcon /> Print Filtered
                            </button>
                        )}
                    </div>

                    {/* Result count + View Mode Toggle — new line */}
                    <div className="flex items-center justify-between gap-3 md:justify-end md:gap-4">
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm font-medium text-ink-400">
                            <span className="font-semibold tabular-nums text-ink-100">{filteredEquipment.length}</span>
                            <span className="text-ink-600">/</span>
                            <span className="tabular-nums text-ink-500">{equipment.length}</span>
                            <span className="text-ink-500">items</span>
                        </span>
                        <div className="flex flex-1 gap-1 rounded-xl border border-line bg-ink-900 p-1 md:flex-none">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all md:flex-none ${viewMode === 'grid' ? 'bg-ink-750 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}
                            >
                                <GridIcon /> Grid
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all md:flex-none ${viewMode === 'list' ? 'bg-ink-750 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}
                            >
                                <ListIcon /> List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bulk Action Bar */}
                {selectedIds.size > 0 && (
                    <div className="panel-raised mb-6 flex animate-slide-down flex-col items-center gap-4 p-4 md:flex-row md:justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                            <span className="rounded-md bg-ember-600 px-2 py-0.5 text-xs font-semibold text-white">{selectedIds.size}</span>
                            item{selectedIds.size > 1 ? 's' : ''} selected
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={bulkPic1}
                                onChange={e => setBulkPic1(e.target.value)}
                                className="select w-auto !py-2 !pr-9 text-xs"
                            >
                                <option value="">Assign PIC 1…</option>
                                <option value="unassign">Unassigned</option>
                                {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button
                                onClick={() => handleBulkAssign('pic_1_id', bulkPic1 === 'unassign' ? '' : bulkPic1)}
                                disabled={!bulkPic1}
                                className="btn btn-ghost px-3 py-2 text-xs disabled:opacity-50"
                            >
                                Apply
                            </button>

                            <select
                                value={bulkPic2}
                                onChange={e => setBulkPic2(e.target.value)}
                                className="select w-auto !py-2 !pr-9 text-xs"
                            >
                                <option value="">Assign PIC 2…</option>
                                <option value="unassign">Unassigned</option>
                                {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button
                                onClick={() => handleBulkAssign('pic_2_id', bulkPic2 === 'unassign' ? '' : bulkPic2)}
                                disabled={!bulkPic2}
                                className="btn btn-ghost px-3 py-2 text-xs disabled:opacity-50"
                            >
                                Apply
                            </button>

                            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-ink-400 transition-colors hover:text-ink-100 md:ml-2">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Hidden inline photo input */}
                <input
                    type="file"
                    ref={inlinePhotoInputRef}
                    onChange={handleInlinePhotoUpload}
                    accept="image/*"
                    className="hidden"
                />

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-500">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500"></div>
                        <p className="text-sm">Loading masterlist…</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* --- GRID VIEW --- */
                    <>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {paginatedEquipment.map((item) => {
                                const expiryBadge = getExpiryStatus(item);
                                return (
                                <div key={item.id} className={`panel group flex flex-col p-5 transition-colors duration-200 hover:border-line-strong ${expiryBadge ? 'border-amber-900/50' : ''}`}>
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                        <span className="id-pill">{item.no_id}</span>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${getTypeBadgeColor(item.type)}`}>
                                                {item.type}
                                            </span>
                                            {expiryBadge && (
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${expiryBadge.cls}`}>
                                                    ⏰ {expiryBadge.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="mb-0.5 truncate text-base font-semibold text-ink-100">{item.location}</h3>
                                    <p className="mb-4 truncate text-xs text-ink-400">{item.entity} · {item.facility} · {item.area}</p>

                                    {/* PIC pills */}
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {item.pic_1?.name && (
                                            <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                                                {item.pic_1?.image_profile ? (
                                                    <ProtectedImage src={item.pic_1.image_profile} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ember-800 text-xs font-bold text-white">
                                                        {item.pic_1.name[0]}
                                                    </div>
                                                )}
                                                <span className="truncate text-xs text-ink-300">{item.pic_1.name}</span>
                                            </div>
                                        )}
                                        {item.pic_2?.name && (
                                            <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                                                {item.pic_2?.image_profile ? (
                                                    <ProtectedImage src={item.pic_2.image_profile} className="h-5 w-5 flex-shrink-0 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-800 text-xs font-bold text-white">
                                                        {item.pic_2.name[0]}
                                                    </div>
                                                )}
                                                <span className="truncate text-xs text-ink-300">{item.pic_2.name}</span>
                                            </div>
                                        )}
                                        {!item.pic_1?.name && !item.pic_2?.name && (
                                            <span className="text-xs text-ink-600">No PIC assigned</span>
                                        )}
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        <button
                                            onClick={() => handlePrint(item)}
                                            title="Print checklist"
                                            className="icon-btn"
                                        >
                                            <PrintIcon />
                                        </button>
                                        <button
                                            onClick={() => openEditSheet(item)}
                                            className="btn btn-soft flex-1 py-2"
                                        >
                                            <EditIcon /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            title="Delete"
                                            className="icon-btn-danger"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </div>);
                            })}
                            {filteredEquipment.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line py-20 text-ink-500">
                                    <SearchIcon />
                                    <p className="text-sm">
                                        {activeFiltersCount > 0
                                            ? 'No equipment matches the current filters.'
                                            : 'No equipment found. Click "Add Equipment" to create one.'}
                                    </p>
                                </div>
                            )}
                        </div>
                        {totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-center gap-4">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-ghost px-4 py-2 disabled:opacity-50">
                                    Previous
                                </button>
                                <span className="rounded-xl border border-line bg-ink-900 px-4 py-2 text-sm font-medium text-ink-400">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-ghost px-4 py-2 disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    /* --- LIST VIEW --- */
                    <>
                        <div className="table-wrap">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-line bg-ink-950/40">
                                            <th className="th w-10 text-center">
                                                <input type="checkbox" onChange={selectAll} checked={selectedIds.size > 0 && selectedIds.size === paginatedEquipment.length} className="h-4 w-4 rounded border-line bg-ink-850 text-ember-500 focus:ring-ember-500 focus:ring-offset-ink-950" />
                                            </th>
                                            <th className="th">ID</th>
                                            <th className="th">Type</th>
                                            <th className="th">Entity</th>
                                            <th className="th">Facility</th>
                                            <th className="th">Area</th>
                                            <th className="th">Location</th>
                                            <th className="th">PIC 1</th>
                                            <th className="th">PIC 2</th>
                                            <th className="th text-center w-[88px]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {paginatedEquipment.map((item) => {
                                            const expiryBadge = getExpiryStatus(item);

                                            return (
                                                <tr key={item.id} className={`transition-colors group hover:bg-white/[0.03] ${selectedIds.has(item.id) ? 'bg-white/[0.03]' : ''} ${expiryBadge ? 'bg-amber-500/10' : ''}`}>
                                                    <td className="td text-center">
                                                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4 rounded border-line bg-ink-850 text-ember-500 focus:ring-ember-500 focus:ring-offset-ink-950" />
                                                    </td>
                                                    <td className="td">
                                                        <span className="id-pill">{item.no_id}</span>
                                                    </td>
                                                    <td className="td">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.type)}`}>{item.type}</span>
                                                            {expiryBadge && (
                                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${expiryBadge.cls}`}>⏰ {expiryBadge.label}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="td max-w-[110px] truncate text-ink-300">{item.entity || '-'}</td>
                                                    <td className="td max-w-[110px] truncate text-ink-300">{item.facility || '-'}</td>
                                                    <td className="td max-w-[110px] truncate text-ink-300">{item.area || '-'}</td>
                                                    <td className="td max-w-[140px] truncate text-ink-200">{item.location || '-'}</td>
                                                    <td className="td">
                                                        <div className="flex items-center gap-2">
                                                            {item.pic_1?.image_profile ? (
                                                                <ProtectedImage src={item.pic_1.image_profile} className="h-6 w-6 rounded-full object-cover" alt="" />
                                                            ) : item.pic_1?.name ? (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ember-800 text-xs font-bold text-white">{item.pic_1.name[0]}</div>
                                                            ) : (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs text-ink-500">?</div>
                                                            )}
                                                            <select
                                                                value={item.pic_1?.id || ''}
                                                                onChange={(e) => handleInlinePicChange(item.id, 'pic_1_id', e.target.value)}
                                                                className="select !w-32 !py-1.5 !pr-8 text-xs"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className="td">
                                                        <div className="flex items-center gap-2">
                                                            {item.pic_2?.image_profile ? (
                                                                <ProtectedImage src={item.pic_2.image_profile} className="h-6 w-6 rounded-full object-cover" alt="" />
                                                            ) : item.pic_2?.name ? (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-800 text-xs font-bold text-white">{item.pic_2.name[0]}</div>
                                                            ) : (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs text-ink-500">?</div>
                                                            )}
                                                            <select
                                                                value={item.pic_2?.id || ''}
                                                                onChange={(e) => handleInlinePicChange(item.id, 'pic_2_id', e.target.value)}
                                                                className="select !w-32 !py-1.5 !pr-8 text-xs"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>

                                                    <td className="td">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handlePrint(item)}
                                                                title="Print checklist"
                                                                className="icon-btn !p-1.5"
                                                            >
                                                                <PrintIcon />
                                                            </button>
                                                            <button
                                                                onClick={() => openEditSheet(item)}
                                                                title="Edit"
                                                                className="icon-btn !p-1.5"
                                                            >
                                                                <EditIcon />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                title="Delete"
                                                                className="icon-btn-danger !p-1.5"
                                                            >
                                                                <TrashIcon />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredEquipment.length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="py-16 text-center text-ink-500">
                                                    {activeFiltersCount > 0 ? 'No equipment matches the current filters.' : 'No equipment found.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-center gap-4">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-ghost px-4 py-2 disabled:opacity-50">
                                    Previous
                                </button>
                                <span className="rounded-xl border border-line bg-ink-900 px-4 py-2 text-sm font-medium text-ink-400">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-ghost px-4 py-2 disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* --- Side/Bottom Sheet --- */}
            {isSheetOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={closeSheet}
                    />
                    <div
                        className="fixed z-50 flex animate-rise flex-col border-line bg-ink-900
                            bottom-0 left-0 right-0 h-[90vh] rounded-t-3xl border-t md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-full md:w-[480px] md:rounded-none md:border-l"
                        role="dialog"
                        aria-modal="true"
                    >
                <div className="flex items-center justify-between border-b border-line p-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                            {editingItem ? 'Edit record' : 'New record'}
                        </p>
                        <h2 className="text-xl font-semibold text-ink-100">{editingItem ? 'Edit Equipment' : 'Add Equipment'}</h2>
                    </div>
                    <button onClick={closeSheet} className="icon-btn" aria-label="Close">
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                    <form id="equipment-form" onSubmit={handleSave} className="space-y-5">

                        {/* Unique ID */}
                        <div>
                            <label className="field-label">Equipment ID *</label>
                            <input required type="text" name="no_id" value={formData.no_id} onChange={handleInputChange} className="input font-mono" placeholder="e.g. FA-001" />
                        </div>

                        {/* Type */}
                        <div>
                            <label className="field-label">Equipment Type *</label>
                            <div className="relative">
                                <select required name="type" value={formData.type} onChange={handleInputChange} className="select">
                                    <option value="Fire Alarm">Fire Alarm</option>
                                    <option value="Fire Hydrant">Fire Hydrant</option>
                                    <option value="Emergency Lamp">Emergency Lamp</option>
                                    <option value="Fire Extinguisher">Fire Extinguisher</option>
                                </select>
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                                    <ChevronDown />
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="field-label">Entity *</label>
                                <input required type="text" name="entity" value={formData.entity} onChange={handleInputChange} className="input" />
                            </div>
                            <div>
                                <label className="field-label">Facility *</label>
                                <input required type="text" name="facility" value={formData.facility} onChange={handleInputChange} className="input" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="field-label">Area *</label>
                                <input required type="text" name="area" value={formData.area} onChange={handleInputChange} className="input" />
                            </div>
                            <div>
                                <label className="field-label">Location *</label>
                                <input required type="text" name="location" value={formData.location} onChange={handleInputChange} className="input" />
                            </div>
                        </div>

                        {/* --- Dynamic Fields based on Type --- */}

                        {formData.type === 'Fire Alarm' && (
                            <div>
                                <label className="field-label">Zone</label>
                                <input type="text" name="zone" value={formData.zone} onChange={handleInputChange} className="input" />
                            </div>
                        )}

                        {formData.type === 'Fire Hydrant' && (
                            <div>
                                <label className="field-label">Placement</label>
                                <input type="text" name="placement" value={formData.placement} onChange={handleInputChange} className="input" />
                            </div>
                        )}

                        {formData.type === 'Fire Extinguisher' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="field-label">Extinguisher Type</label>
                                        <input type="text" name="extinguisher_type" value={formData.extinguisher_type} onChange={handleInputChange} className="input" />
                                    </div>
                                    <div>
                                        <label className="field-label">Weight (KG)</label>
                                        <input type="number" step="0.1" name="weight_kg" value={formData.weight_kg} onChange={handleInputChange} className="input" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="field-label">Start Date</label>
                                        <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} className="input" />
                                    </div>
                                    <div>
                                        <label className="field-label">Expire Date</label>
                                        <input type="date" name="expire_date" value={formData.expire_date} onChange={handleInputChange} className="input" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* --- PIC Assignment --- */}
                        <div className="space-y-4 border-t border-line pt-5">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Assign Personnel</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="field-label">Primary PIC</label>
                                    <div className="relative">
                                        <select name="pic_1_id" value={formData.pic_1_id} onChange={handleInputChange} className="select">
                                            <option value="">-- Unassigned --</option>
                                            {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                                            <ChevronDown />
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="field-label">Secondary PIC</label>
                                    <div className="relative">
                                        <select name="pic_2_id" value={formData.pic_2_id} onChange={handleInputChange} className="select">
                                            <option value="">-- Unassigned --</option>
                                            {pics.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">
                                            <ChevronDown />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- Photo Upload in Form --- */}
                        <div className="space-y-3 border-t border-line pt-5">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Equipment Photos</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Photo 1 */}
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-ink-400">Photo 1</label>
                                    <div className="group/photo relative">
                                        {formData.pic_1_photo ? (
                                            <ProtectedImage src={formData.pic_1_photo} alt="Photo 1" className="h-32 w-full rounded-xl border border-line object-cover" />
                                        ) : (
                                            <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-ink-600">
                                                <CameraIcon />
                                                <span className="text-xs">No photo</span>
                                            </div>
                                        )}
                                        <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover/photo:opacity-100">
                                            <span className="rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-100">
                                                {uploadingPhoto?.slot === 'pic_1_photo' ? 'Uploading…' : 'Change Photo'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFormPhotoUpload(e, 'pic_1_photo')}
                                                disabled={!!uploadingPhoto}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {/* Photo 2 */}
                                <div>
                                    <label className="mb-2 block text-xs font-medium text-ink-400">Photo 2</label>
                                    <div className="group/photo relative">
                                        {formData.pic_2_photo ? (
                                            <ProtectedImage src={formData.pic_2_photo} alt="Photo 2" className="h-32 w-full rounded-xl border border-line object-cover" />
                                        ) : (
                                            <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-ink-600">
                                                <CameraIcon />
                                                <span className="text-xs">No photo</span>
                                            </div>
                                        )}
                                        <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover/photo:opacity-100">
                                            <span className="rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-100">
                                                {uploadingPhoto?.slot === 'pic_2_photo' ? 'Uploading…' : 'Change Photo'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFormPhotoUpload(e, 'pic_2_photo')}
                                                disabled={!!uploadingPhoto}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {!editingItem && (
                                <p className="text-xs text-ink-500">Save the equipment first, then photos can be uploaded and stored.</p>
                            )}
                        </div>

                    </form>
                </div>

                <div className="flex justify-end gap-3 border-t border-line bg-ink-950 p-6">
                    <button type="button" onClick={closeSheet} className="btn btn-ghost">
                        Cancel
                    </button>
                    <button type="submit" form="equipment-form" disabled={isSaving} className="btn btn-primary disabled:opacity-50">
                        {isSaving ? 'Saving…' : 'Save Equipment'}
                    </button>
                </div>
            </div>
      </>)}

            {/* Modals */}
            <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
            <AlertModal state={alertModal} onClose={() => setAlertModal(null)} />
            <ImageModal
                imageUrl={previewImage?.url || null}
                title={previewImage?.title || 'Image Preview'}
                onClose={() => setPreviewImage(null)}
            />
        </div>
    );
}
