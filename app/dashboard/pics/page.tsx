'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { deleteStorageFiles } from '@/app/lib/storageHelpers';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ConfirmModal, AlertModal, ConfirmState, AlertState } from '@/app/components/ui/CustomModal';
import ImageModal from '@/app/components/ui/ImageModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';

interface Pic {
    id: string;
    name: string;
    phone: string | null;
    entity: string | null;
    facility: string | null;
    image_profile: string | null;
    image_contact: string | null;
    signature_url: string | null;
    created_at?: string;
}

const initialFormData = {
    id: '',
    name: '',
    phone: '',
    entity: '',
    facility: ''
};

export default function PICDashboard() {
    const [pics, setPics] = useState<Pic[]>([]);
    const [uniqueEntities, setUniqueEntities] = useState<string[]>([]);
    const [uniqueFacilities, setUniqueFacilities] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
    const [alertModal, setAlertModal] = useState<AlertState | null>(null);
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

    // UI State for Sheet
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Pic | null>(null);
    const [formData, setFormData] = useState(initialFormData);

    // File states
    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [contactFile, setContactFile] = useState<File | null>(null);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const supabase = getSupabaseClient();
    const router = useRouter();
    const [reloadTrigger, setReloadTrigger] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/');
                return;
            }

            const { data, error } = await supabase
                .from('pic')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) setPics(data);

            // Fetch equipment entities & facilities for dropdown options
            const { data: eqData } = await supabase.from('equipment').select('entity, facility');
            if (eqData) {
                const entities = Array.from(new Set(eqData.map((e: { entity: string | null }) => e.entity).filter(Boolean))) as string[];
                const facilities = Array.from(new Set(eqData.map((e: { facility: string | null }) => e.facility).filter(Boolean))) as string[];
                setUniqueEntities(entities.sort());
                setUniqueFacilities(facilities.sort());
            }

            setLoading(false);
        };

        loadData();
    }, [supabase, router, reloadTrigger]);

    const openCreateSheet = () => {
        setEditingItem(null);
        setFormData(initialFormData);
        setProfileFile(null);
        setContactFile(null);
        setSignatureFile(null);
        setIsSheetOpen(true);
    };

    const openEditSheet = (item: Pic) => {
        setEditingItem(item);
        setFormData({
            id: item.id || '',
            name: item.name || '',
            phone: item.phone || '',
            entity: item.entity || '',
            facility: item.facility || ''
        });
        setProfileFile(null);
        setContactFile(null);
        setSignatureFile(null);
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

        let profileUrl = editingItem?.image_profile || null;
        let contactUrl = editingItem?.image_contact || null;
        let signatureUrl = editingItem?.signature_url || null;

        const deleteOldFile = async (bucket: string, url: string | null) => {
            if (!url) return;
            const parts = url.split('/');
            const filename = parts.pop();
            if (filename) {
                await supabase.storage.from(bucket).remove([filename]);
            }
        };

        // Upload Profile Image
        if (profileFile) {
            const ext = profileFile.name.split('.').pop();
            const fileName = `${Date.now()}_profile.${ext}`;
            const { error: uploadError, data } = await supabase.storage
                .from('pic_images')
                .upload(fileName, profileFile, { upsert: true });

            if (!uploadError && data) {
                if (editingItem?.image_profile) await deleteOldFile('pic_images', editingItem.image_profile);
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                profileUrl = publicUrl;
            } else if (uploadError) {
                setAlertModal({ isOpen: true, title: 'Upload Error', message: `Profile Upload Error: ${uploadError.message}`, type: 'error' });
            }
        }

        // Upload Contact Image
        if (contactFile) {
            const ext = contactFile.name.split('.').pop();
            const fileName = `${Date.now()}_contact.${ext}`;
            const { error: uploadError, data } = await supabase.storage
                .from('pic_images')
                .upload(fileName, contactFile, { upsert: true });

            if (!uploadError && data) {
                if (editingItem?.image_contact) await deleteOldFile('pic_images', editingItem.image_contact);
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                contactUrl = publicUrl;
            } else if (uploadError) {
                setAlertModal({ isOpen: true, title: 'Upload Error', message: `Contact Card Upload Error: ${uploadError.message}`, type: 'error' });
            }
        }

        // Upload Signature Image
        if (signatureFile) {
            const ext = signatureFile.name.split('.').pop();
            const fileName = `${Date.now()}_signature.${ext}`;
            const { error: uploadError, data } = await supabase.storage
                .from('pic_images')
                .upload(fileName, signatureFile, { upsert: true });

            if (!uploadError && data) {
                if (editingItem?.signature_url) await deleteOldFile('pic_images', editingItem.signature_url);
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                signatureUrl = publicUrl;
            } else if (uploadError) {
                setAlertModal({ isOpen: true, title: 'Upload Error', message: `Signature Upload Error: ${uploadError.message}`, type: 'error' });
            }
        }

        const payload: {
            id?: string;
            name: string;
            phone: string | null;
            entity: string | null;
            facility: string | null;
            image_profile: string | null;
            image_contact: string | null;
            signature_url: string | null;
        } = {
            name: formData.name,
            phone: formData.phone || null,
            entity: formData.entity || null,
            facility: formData.facility || null,
            image_profile: profileUrl,
            image_contact: contactUrl,
            signature_url: signatureUrl
        };

        if (editingItem && editingItem.id) {
            payload.id = editingItem.id;
        }

        const { error } = await supabase.from('pic').upsert(payload);

        setIsSaving(false);
        if (!error) {
            closeSheet();
            setLoading(true);
            setReloadTrigger((t) => t + 1);
        } else {
            setAlertModal({ isOpen: true, title: 'Save Error', message: error.message, type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete PIC',
            message: 'Are you sure you want to delete this PIC profile?',
            variant: 'danger',
            onConfirm: async () => {
                const picToDelete = pics.find(p => p.id === id);
                if (picToDelete) {
                    await deleteStorageFiles(supabase, 'pic_images', [
                        picToDelete.image_profile,
                        picToDelete.image_contact,
                        picToDelete.signature_url
                    ]);
                }

                const { error } = await supabase.from('pic').delete().eq('id', id);
                if (!error) {
                    setLoading(true);
                    setReloadTrigger((t) => t + 1);
                } else {
                    setAlertModal({ isOpen: true, title: 'Error', message: error.message, type: 'error' });
                }
            }
        });
    };

    // Account creation state
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountFormData, setAccountFormData] = useState({
        email: '',
        password: '',
        role: 'inspector',
        entity: '',
        facility: ''
    });
    const [accountLoading, setAccountLoading] = useState(false);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [selectedPicForAccount, setSelectedPicForAccount] = useState<Pic | null>(null);

    useEffect(() => {
        if (!isSheetOpen && !isAccountModalOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeSheet();
                setIsAccountModalOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSheetOpen, isAccountModalOpen]);

    const openAccountModal = (pic: Pic) => {
        setSelectedPicForAccount(pic);
        setAccountFormData({
            email: '',
            password: '',
            role: 'inspector',
            entity: pic.entity || '',
            facility: pic.facility || ''
        });
        setAccountError(null);
        setIsAccountModalOpen(true);
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPicForAccount) return;
        setAccountLoading(true);
        setAccountError(null);

        try {
            const res = await fetch('/api/admin/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: accountFormData.email,
                    password: accountFormData.password,
                    picId: selectedPicForAccount.id,
                    role: accountFormData.role,
                    entity: accountFormData.entity || null,
                    facility: accountFormData.facility || null
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create account');

            setAlertModal({
                isOpen: true,
                title: 'Account Created',
                message: `${accountFormData.role.toUpperCase()} Account created successfully for ${selectedPicForAccount.name}`,
                type: 'success'
            });
            setIsAccountModalOpen(false);
            setLoading(true);
            setReloadTrigger((t) => t + 1);
        } catch (err) {
            setAccountError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setAccountLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-ink-950 text-ink-200 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                <header className="panel mb-8 flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-600/15 text-ember-400 border border-ember-900/50">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Personnel & Roles</p>
                            <h1 className="text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
                                PIC & Inspector Administration
                            </h1>
                            <p className="mt-0.5 text-sm text-ink-400">Manage PIC profiles, Inspector roles, assigned entity & facility scopes</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        <Link href="/dashboard" className="btn btn-ghost">
                            Back to Equipment
                        </Link>
                        <button
                            onClick={openCreateSheet}
                            className="btn btn-primary"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                            Add PIC
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-500">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500"></div>
                        <p className="text-sm">Loading PICs…</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {pics.map((item) => (
                            <div key={item.id} className="panel flex flex-col items-center p-6 text-center transition-colors duration-200 hover:border-line-strong justify-between">
                                <div className="flex flex-col items-center w-full">
                                    <div className="relative mb-3">
                                        {item.image_profile ? (
                                            <ProtectedImage
                                                src={item.image_profile}
                                                alt={item.name}
                                                onPreview={() => setPreviewImage({ url: item.image_profile!, title: `${item.name} - Profile Image` })}
                                                className="h-24 w-24 rounded-full border-2 border-line object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-line bg-ink-800 text-2xl font-bold text-ink-500">
                                                {item.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="text-lg font-semibold text-ink-100">{item.name}</h3>
                                    <p className="text-xs text-ink-400 mt-0.5">{item.phone || 'No phone number'}</p>

                                    {/* Entity & Facility Scope Badges */}
                                    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 w-full">
                                        {item.entity ? (
<span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border tone-ember">
                            {item.entity}
                                        </span>
                                        ) : (
                                            <span className="text-[10px] text-ink-600 italic">All Entities</span>
                                        )}
                                        {item.facility ? (
<span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border tone-sky">
                            {item.facility}
                                        </span>
                                        ) : (
                                            <span className="text-[10px] text-ink-600 italic">All Facilities</span>
                                        )}
                                    </div>

                                    {/* Signature preview */}
                                    {item.signature_url && (
                                        <div className="mt-3 h-10 w-28 bg-white/5 border border-line rounded-lg p-1 flex items-center justify-center">
                                            <ProtectedImage
                                                src={item.signature_url}
                                                alt="Signature"
                                                onPreview={() => setPreviewImage({ url: item.signature_url!, title: `${item.name} - Digital Signature` })}
                                                className="h-full object-contain"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 flex flex-col gap-2 w-full pt-4 border-t border-line">
                                    <button
                                        onClick={() => openAccountModal(item)}
                                        className="btn btn-soft text-xs w-full justify-center text-ember-500 hover:text-ember-600"
                                    >
                                        Create User Account
                                    </button>
                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={() => openEditSheet(item)}
                                            className="btn btn-ghost text-xs flex-1 justify-center"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="btn btn-danger-soft text-xs px-3"
                                            title="Delete PIC"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit PIC Drawer */}
            {isSheetOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeSheet} />
                    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-ink-900 border-l border-line p-6 overflow-y-auto flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
                                <h2 className="text-lg font-bold text-ink-100">
                                    {editingItem ? 'Edit PIC & Role Scope' : 'Add New PIC'}
                                </h2>
                                <button onClick={closeSheet} className="text-ink-400 hover:text-ink-100">✕</button>
                            </div>

                            <form id="pic-form" onSubmit={handleSave} className="space-y-4 text-xs">
                                <div>
                                    <label className="field-label">Full Name *</label>
                                    <input
                                        required
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="input text-xs"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div>
                                    <label className="field-label">Phone Number</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="input text-xs"
                                        placeholder="+62 812..."
                                    />
                                </div>

                                <div>
                                    <label className="field-label">Assigned Entity Scope</label>
                                    <input
                                        type="text"
                                        name="entity"
                                        value={formData.entity}
                                        onChange={handleInputChange}
                                        list="entities-list"
                                        className="input text-xs"
                                        placeholder="e.g. PT System Hub / All"
                                    />
                                    <datalist id="entities-list">
                                        {uniqueEntities.map(e => <option key={e} value={e} />)}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="field-label">Assigned Facility Scope</label>
                                    <input
                                        type="text"
                                        name="facility"
                                        value={formData.facility}
                                        onChange={handleInputChange}
                                        list="facilities-list"
                                        className="input text-xs"
                                        placeholder="e.g. Building A / Main Office"
                                    />
                                    <datalist id="facilities-list">
                                        {uniqueFacilities.map(f => <option key={f} value={f} />)}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="field-label">Profile Image</label>
                                    {editingItem?.image_profile && (
                                        <div className="mb-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={editingItem.image_profile} alt="Profile" className="h-16 w-16 rounded-full border border-line object-cover" />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                                        className="input text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="field-label">Digital Signature Image</label>
                                    {editingItem?.signature_url && (
                                        <div className="mb-2 h-12 w-28 bg-white/5 border border-line rounded p-1">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={editingItem.signature_url} alt="Signature" className="h-full object-contain" />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                                        className="input text-xs"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-line mt-6">
                            <button type="button" onClick={closeSheet} className="btn btn-ghost text-xs">
                                Cancel
                            </button>
                            <button type="submit" form="pic-form" disabled={isSaving} className="btn btn-primary text-xs">
                                {isSaving ? 'Saving…' : 'Save PIC'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Create User Account Modal with Role, Entity & Facility */}
            {isAccountModalOpen && selectedPicForAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
                    <div className="relative w-full max-w-sm bg-ink-900 border border-line rounded-2xl shadow-2xl p-6">
                        <h2 className="text-xl font-semibold text-ink-100">Create User Account</h2>
                        <p className="text-xs text-ink-400 mt-1 mb-4">
                            For <strong className="text-ink-200">{selectedPicForAccount.name}</strong>
                        </p>

                        {accountError && (
                            <div className="mb-4 rounded-xl border p-3 text-xs tone-rose">
                                {accountError}
                            </div>
                        )}

                        <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
                            <div>
                                <label className="field-label text-[10px]">Email *</label>
                                <input
                                    required
                                    type="email"
                                    value={accountFormData.email}
                                    onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                                    className="input text-xs"
                                    placeholder="inspector@example.com"
                                />
                            </div>

                            <div>
                                <label className="field-label text-[10px]">Password *</label>
                                <input
                                    required
                                    type="password"
                                    value={accountFormData.password}
                                    onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                                    className="input text-xs"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="field-label text-[10px]">User Role *</label>
                                <select
                                    value={accountFormData.role}
                                    onChange={(e) => setAccountFormData({ ...accountFormData, role: e.target.value })}
                                    className="input text-xs"
                                >
                                    <option value="inspector">Inspector</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>

                            <div>
                                <label className="field-label text-[10px]">Entity Scope</label>
                                <input
                                    type="text"
                                    value={accountFormData.entity}
                                    onChange={(e) => setAccountFormData({ ...accountFormData, entity: e.target.value })}
                                    className="input text-xs"
                                    placeholder="Entity Name or blank for All"
                                    list="acc-entities"
                                />
                                <datalist id="acc-entities">
                                    {uniqueEntities.map(e => <option key={e} value={e} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="field-label text-[10px]">Facility Scope</label>
                                <input
                                    type="text"
                                    value={accountFormData.facility}
                                    onChange={(e) => setAccountFormData({ ...accountFormData, facility: e.target.value })}
                                    className="input text-xs"
                                    placeholder="Facility Name or blank for All"
                                    list="acc-facilities"
                                />
                                <datalist id="acc-facilities">
                                    {uniqueFacilities.map(f => <option key={f} value={f} />)}
                                </datalist>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-line mt-6">
                                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="btn btn-ghost text-xs">
                                    Cancel
                                </button>
                                <button type="submit" disabled={accountLoading} className="btn btn-primary text-xs min-w-24">
                                    {accountLoading ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
