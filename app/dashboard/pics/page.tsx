'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const initialFormData = {
    id: '',
    name: '',
    phone: ''
};

export default function PICDashboard() {
    const [pics, setPics] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State for Sheet
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState(initialFormData);
    
    // File states
    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [contactFile, setContactFile] = useState<File | null>(null);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const supabase = getSupabaseClient();
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/');
                return;
            }
            fetchData();
        };
        checkUser();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pic')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) setPics(data);
        setLoading(false);
    };

    const openCreateSheet = () => {
        setEditingItem(null);
        setFormData(initialFormData);
        setProfileFile(null);
        setContactFile(null);
        setSignatureFile(null);
        setIsSheetOpen(true);
    };

    const openEditSheet = (item: any) => {
        setEditingItem(item);
        setFormData({
            id: item.id || '',
            name: item.name || '',
            phone: item.phone || ''
        });
        setProfileFile(null);
        setContactFile(null);
        setSignatureFile(null);
        setIsSheetOpen(true);
    };

    const closeSheet = () => {
        setIsSheetOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        let profileUrl = editingItem?.image_profile || null;
        let contactUrl = editingItem?.image_contact || null;
        let signatureUrl = editingItem?.signature_url || null;

        // Upload Profile Image
        if (profileFile) {
            const ext = profileFile.name.split('.').pop();
            const fileName = `${Date.now()}_profile.${ext}`;
            const { error: uploadError, data } = await supabase.storage
                .from('pic_images')
                .upload(fileName, profileFile, { upsert: true });
            
            if (!uploadError && data) {
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                profileUrl = publicUrl;
            } else if (uploadError) {
                alert(`Profile Upload Error: ${uploadError.message}`);
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
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                contactUrl = publicUrl;
            } else if (uploadError) {
                alert(`Contact Upload Error: ${uploadError.message}`);
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
                const { data: { publicUrl } } = supabase.storage.from('pic_images').getPublicUrl(data.path);
                signatureUrl = publicUrl;
            } else if (uploadError) {
                alert(`Signature Upload Error: ${uploadError.message}`);
            }
        }

        const payload: any = { 
            name: formData.name, 
            phone: formData.phone || null,
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
            fetchData();
        } else {
            alert(error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this PIC?')) return;
        
        const picToDelete = pics.find(p => p.id === id);
        const { error } = await supabase.from('pic').delete().eq('id', id);
        
        if (!error) {
            fetchData();
            if (picToDelete) {
                const pathsToDelete = [];
                if (picToDelete.image_profile) {
                    const parts = picToDelete.image_profile.split('/');
                    pathsToDelete.push(parts[parts.length - 1]);
                }
                if (picToDelete.image_contact) {
                    const parts = picToDelete.image_contact.split('/');
                    pathsToDelete.push(parts[parts.length - 1]);
                }
                if (picToDelete.signature_url) {
                    const parts = picToDelete.signature_url.split('/');
                    pathsToDelete.push(parts[parts.length - 1]);
                }
                if (pathsToDelete.length > 0) {
                    supabase.storage.from('pic_images').remove(pathsToDelete);
                }
            }
        } else {
            alert(error.message);
        }
    };

    useEffect(() => {
        if (!isSheetOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeSheet();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSheetOpen]);

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
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Personnel</p>
                            <h1 className="text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
                                PIC Administration
                            </h1>
                            <p className="mt-0.5 text-sm text-ink-400">Manage Persons in Charge, contact cards & digital signatures</p>
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
                            <div key={item.id} className="panel flex flex-col items-center p-6 text-center transition-colors duration-200 hover:border-line-strong">
                                <div className="relative mb-4">
                                    {item.image_profile ? (
                                        <img src={item.image_profile} alt={item.name} className="h-24 w-24 rounded-full border-2 border-line object-cover" />
                                    ) : (
                                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-line bg-ink-800 text-2xl font-bold text-ink-500">
                                            {item.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-lg font-semibold text-ink-100">{item.name}</h3>
                                <p className="mb-2 text-sm text-ink-400">{item.phone || 'No phone provided'}</p>

                                {/* Signature Badge */}
                                {item.signature_url ? (
                                    <div className="my-3 p-2 rounded-xl bg-white/5 border border-line w-full flex flex-col items-center">
                                        <span className="text-[10px] text-ink-500 font-semibold uppercase tracking-wider mb-1">Digital Signature</span>
                                        <img src={item.signature_url} alt="Signature" className="h-10 object-contain invert dark:invert-0" />
                                    </div>
                                ) : (
                                    <span className="my-2 text-[10px] text-ink-600 bg-ink-900 border border-line px-2 py-0.5 rounded-md">No Signature Attached</span>
                                )}

                                {item.image_contact && (
                                    <a href={item.image_contact} target="_blank" rel="noreferrer" className="mb-4 text-xs font-medium text-ember-400 hover:text-ember-300 underline">
                                        View Contact Card
                                    </a>
                                )}

                                <div className="mt-auto flex w-full gap-2 pt-3 border-t border-line">
                                    <button
                                        onClick={() => openEditSheet(item)}
                                        className="btn btn-soft flex-1 py-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="btn btn-danger-soft py-2"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                        {pics.length === 0 && (
                            <div className="col-span-full rounded-2xl border border-dashed border-line py-16 text-center text-ink-500">
                                No PICs found. Click "Add PIC" to create one.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- Side/Bottom Sheet --- */}
            {isSheetOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={closeSheet}
                    />
                    <div className="fixed z-50 flex animate-rise flex-col border-line bg-ink-900
                        bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl border-t md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-full md:w-[450px] md:rounded-none md:border-l"
                        role="dialog" aria-modal="true"
                    >
                <div className="flex items-center justify-between border-b border-line p-6">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                            {editingItem ? 'Edit record' : 'New record'}
                        </p>
                        <h2 className="text-xl font-semibold text-ink-100">{editingItem ? 'Edit PIC' : 'Add PIC'}</h2>
                    </div>
                    <button onClick={closeSheet} className="icon-btn" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                    <form id="pic-form" onSubmit={handleSave} className="space-y-5">

                        <div>
                            <label className="field-label">Full Name *</label>
                            <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="input" placeholder="e.g. John Doe" />
                        </div>

                        <div>
                            <label className="field-label">Phone Number</label>
                            <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="input" placeholder="e.g. +1 234 567 8900" />
                        </div>

                        <div className="space-y-4 border-t border-line pt-5">
                            <div>
                                <label className="field-label">Profile Image</label>
                                {editingItem?.image_profile && (
                                    <div className="mb-2">
                                        <img src={editingItem.image_profile} alt="Profile" className="h-16 w-16 rounded-full border border-line object-cover" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-ink-400 file:mr-4 file:rounded-lg file:border-0 file:bg-white/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-200 hover:file:bg-white/[0.1]"
                                />
                            </div>

                            <div>
                                <label className="field-label">Digital Signature Image (PNG with transparent background recommended)</label>
                                {editingItem?.signature_url && (
                                    <div className="mb-2 p-2 rounded-xl bg-white/10 border border-line max-w-xs">
                                        <img src={editingItem.signature_url} alt="Signature" className="h-12 object-contain" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-ink-400 file:mr-4 file:rounded-lg file:border-0 file:bg-white/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-200 hover:file:bg-white/[0.1]"
                                />
                            </div>

                            <div>
                                <label className="field-label">Contact Card Image</label>
                                {editingItem?.image_contact && (
                                    <div className="mb-2">
                                        <img src={editingItem.image_contact} alt="Contact" className="h-16 w-16 rounded-lg border border-line object-cover" />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setContactFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-ink-400 file:mr-4 file:rounded-lg file:border-0 file:bg-white/[0.06] file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink-200 hover:file:bg-white/[0.1]"
                                />
                            </div>
                        </div>

                    </form>
                </div>

                <div className="flex justify-end gap-3 border-t border-line bg-ink-950 p-6">
                    <button type="button" onClick={closeSheet} className="btn btn-ghost">
                        Cancel
                    </button>
                    <button type="submit" form="pic-form" disabled={isSaving} className="btn btn-primary disabled:opacity-50">
                        {isSaving ? 'Uploading & Saving…' : 'Save PIC'}
                    </button>
                </div>
            </div>
      </>)}
        </div>
    );
}
