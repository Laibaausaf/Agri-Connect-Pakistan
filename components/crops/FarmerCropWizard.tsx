'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, Sprout, Trash2, UploadCloud } from 'lucide-react';
import type { ReactNode } from 'react';

type CropOption = { id: string; name: string; nameUrdu: string | null; imageUrl: string | null };
type Props = {
  action: (formData: FormData) => Promise<{ error?: string } | null | undefined | void>;
  crops: CropOption[];
  priceByCrop: Record<string, number>;
  defaults: { village: string; city: string; province: string; today: string };
};
const provinces = ['Khyber Pakhtunkhwa', 'Punjab', 'Sindh', 'Balochistan', 'Islamabad Capital Territory'];
const grades = ['Grade A', 'Grade B', 'Grade C'];
const inputClass = 'w-full rounded-2xl border-2 border-[#D9E2DC] bg-white px-4 py-4 text-lg text-charcoal outline-none focus:border-agri-700 focus:ring-2 focus:ring-[#B7D4C8]';

export default function FarmerCropWizard({ action, crops, priceByCrop, defaults }: Props) {
  const [step, setStep] = useState(0);
  const [cropId, setCropId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [priceChoice, setPriceChoice] = useState<'suggested' | 'custom' | 'offers'>('suggested');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [variety, setVariety] = useState('');
  const [grade, setGrade] = useState('Grade A');
  const [village, setVillage] = useState(defaults.village);
  const [city, setCity] = useState(defaults.city);
  const [province, setProvince] = useState(defaults.province);
  const [harvestDate, setHarvestDate] = useState(defaults.today);
  const [readyDate, setReadyDate] = useState('');
  const [packaging, setPackaging] = useState('');
  const [notes, setNotes] = useState('');
  const [state, formAction, pending] = useActionState(async (_prev: { error?: string } | null, formData: FormData) => action(formData) as Promise<{ error?: string } | null>, null);
  const selectedCrop = crops.find((crop) => crop.id === cropId);
  const suggestedPrice = cropId ? priceByCrop[cropId] : undefined;
  const stepTitles = ['Which crop did you grow?', 'How much crop is ready?', 'What price would you like?', 'Add crop pictures', 'A few final details', 'Check your crop details'];
  const progress = ((step + 1) / stepTitles.length) * 100;
  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(cropId);
    if (step === 1) return Number(quantity) > 0 && Number(quantity) <= 500000;
    if (step === 2) return priceChoice !== 'custom' || Number(price) > 0;
    if (step === 4) return city.trim().length >= 2 && Boolean(province) && Boolean(harvestDate);
    return true;
  }, [step, cropId, quantity, priceChoice, price, city, province, harvestDate]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadError('');
    const accepted = Array.from(fileList).filter((file) => ['image/png', 'image/jpeg'].includes(file.type));
    if (accepted.length !== fileList.length) setUploadError('Please choose PNG, JPG, or JPEG images only.');
    if (!accepted.length) return;
    if (photos.length + accepted.length > 5) { setUploadError('You can add up to 5 pictures.'); return; }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of accepted) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB. Choose a smaller picture.`);
        const body = new FormData(); body.append('file', file);
        const response = await fetch('/api/crop-photos/upload', { method: 'POST', body });
        const result = await response.json();
        if (!response.ok || !result.url) throw new Error(result.error || 'Could not upload the picture. Please try again.');
        uploaded.push(result.url as string);
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally { setUploading(false); }
  }

  const field = (label: string, content: ReactNode, hint?: string) => <label className="block"><span className="mb-2 block text-base font-bold text-charcoal">{label}</span>{content}{hint && <span className="mt-2 block text-sm text-[#636E72]">{hint}</span>}</label>;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="cropId" value={cropId} />
      <input type="hidden" name="quantityKg" value={quantity} />
      <input type="hidden" name="askingPricePerKg" value={priceChoice === 'offers' ? '' : priceChoice === 'suggested' ? (suggestedPrice ?? '') : price} />
      <input type="hidden" name="photos" value={photos.join('\n')} />
      <input type="hidden" name="variety" value={variety} />
      <input type="hidden" name="grade" value={grade} />
      <input type="hidden" name="originVillage" value={village} />
      <input type="hidden" name="originCity" value={city} />
      <input type="hidden" name="originProvince" value={province} />
      <input type="hidden" name="harvestDate" value={harvestDate} />
      <input type="hidden" name="readyDate" value={readyDate} />
      <input type="hidden" name="packaging" value={packaging} />
      <input type="hidden" name="notes" value={notes} />

      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#636E72]"><span>Step {step + 1} of {stepTitles.length}</span><span>{Math.round(progress)}% complete</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#E8EEE9]"><div className="h-full rounded-full bg-agri-900 transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="min-h-[330px]">
        <h2 className="mb-2 text-2xl font-extrabold leading-tight text-charcoal">{stepTitles[step]}</h2>
        <p className="mb-6 text-base text-[#636E72]">{['Choose the crop you want to sell.', 'Enter the total amount you have. We use kilograms.', 'You can accept a suggested reference price or let buyers make offers.', 'A clear picture helps buyers understand the quality of your crop.', 'Tell buyers where the crop is and when it is ready.', 'Make sure everything looks right before saving.'][step]}</p>

        {step === 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{crops.map((crop) => <button type="button" key={crop.id} onClick={() => { setCropId(crop.id); setPriceChoice(priceByCrop[crop.id] === undefined ? 'offers' : 'suggested'); setPrice(''); }} className={`rounded-2xl border-2 p-4 text-left transition ${cropId === crop.id ? 'border-agri-900 bg-[#E8F3EE] ring-2 ring-[#B7D4C8]' : 'border-[#E5E7EB] hover:border-[#B7D4C8]'}`}><span className="mb-3 flex h-16 items-center justify-center rounded-xl bg-[#F5F7F3]"><Sprout className="h-8 w-8 text-agri-900" /></span><span className="block text-base font-bold">{crop.name}</span>{crop.nameUrdu && <span className="mt-1 block text-sm text-[#636E72]">{crop.nameUrdu}</span>}</button>)}</div>}

        {step === 1 && <div className="space-y-4">{field('How many kilograms do you have?', <input className={inputClass} type="number" inputMode="decimal" min="1" max="500000" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 500" autoFocus />, 'Example: 500 means five hundred kilograms. You can enter a number only.')}{quantity && Number(quantity) > 0 && <div className="rounded-2xl bg-[#E8F3EE] p-4 text-lg font-semibold text-agri-900">Your crop amount: {Number(quantity).toLocaleString()} kg</div>}</div>}

        {step === 2 && <div className="space-y-3">{suggestedPrice !== undefined && <button type="button" onClick={() => setPriceChoice('suggested')} className={`w-full rounded-2xl border-2 p-4 text-left ${priceChoice === 'suggested' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">Use suggested reference price</span><span className="mt-1 block text-xl font-extrabold text-agri-900">Rs {suggestedPrice.toLocaleString('en-PK')} per kg</span><span className="mt-1 block text-sm text-[#636E72]">From the app’s stored market-price records. This may not be a live quote.</span></button>}{suggestedPrice === undefined && <div className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900">No reference price is available for {selectedCrop?.name ?? 'this crop'} right now.</div>}<button type="button" onClick={() => setPriceChoice('custom')} className={`w-full rounded-2xl border-2 p-4 text-left ${priceChoice === 'custom' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">I want to set my own price</span><span className="mt-1 block text-sm text-[#636E72]">Enter the amount you want for each kilogram.</span>{priceChoice === 'custom' && <input className={`${inputClass} mt-3`} type="number" min="1" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Rs per kg" />}</button><button type="button" onClick={() => setPriceChoice('offers')} className={`w-full rounded-2xl border-2 p-4 text-left ${priceChoice === 'offers' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">Let buyers make me an offer</span><span className="mt-1 block text-sm text-[#636E72]">You do not need to decide a price now.</span></button></div>}

        {step === 3 && <div className="space-y-4"><div className="rounded-2xl border-2 border-dashed border-[#B7D4C8] bg-[#F8FAF7] p-6 text-center"><span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F3EE]"><ImagePlus className="h-8 w-8 text-agri-900" /></span><h3 className="text-lg font-bold">Take a clear picture of your crop</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#636E72]">Put a small amount of crop in good light. Keep the camera steady and make sure the crop is clearly visible. You can take a new picture or choose one from your phone.</p><label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-agri-900 px-5 py-3 text-base font-bold text-white"><UploadCloud className="h-5 w-5" />{uploading ? 'Uploading…' : 'Take or choose pictures'}<input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple capture="environment" disabled={uploading || photos.length >= 5} className="sr-only" onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ''; }} /></label><p className="mt-3 text-xs text-[#636E72]">PNG, JPG or JPEG · up to 8 MB each · maximum 5 pictures</p></div>{uploadError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{uploadError}</p>}{photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <div key={photo} className="relative overflow-hidden rounded-xl border border-[#E5E7EB]"><img src={photo} alt="Uploaded crop" className="h-32 w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((p) => p !== photo))} className="absolute right-2 top-2 rounded-full bg-white p-2 text-red-700 shadow" aria-label="Remove picture"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div>}

        {step === 4 && <div className="space-y-5">{field('Which village are you from? (optional)', <input className={inputClass} value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village name" />)}{field('Which city or tehsil is the crop in?', <input required minLength={2} className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City or tehsil" />)}{field('Which province?', <select className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)}>{provinces.map((p) => <option key={p}>{p}</option>)}</select>)}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{field('When did you harvest it?', <input className={inputClass} type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} required />)}{field('When will it be ready? (optional)', <input className={inputClass} type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} />)}</div>{field('How is it packed? (optional)', <input className={inputClass} value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="e.g. sacks or crates" />)}{field('Anything else buyers should know? (optional)', <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. freshly harvested, good quality" />)}</div>}

        {step === 5 && <div className="space-y-3 rounded-2xl bg-[#F8FAF7] p-4">{selectedCrop && <div className="flex items-center gap-3 rounded-xl bg-white p-3">{selectedCrop.imageUrl ? <img src={selectedCrop.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <Sprout className="h-10 w-10 text-agri-900" />}<div><div className="text-xl font-extrabold">{selectedCrop.name}</div><div className="text-sm text-[#636E72]">Your crop listing</div></div></div>}<ReviewRow label="Quantity" value={`${Number(quantity).toLocaleString()} kg`} /><ReviewRow label="Price" value={priceChoice === 'offers' ? 'Buyers can make offers' : `Rs ${Number(priceChoice === 'suggested' ? suggestedPrice : price).toLocaleString('en-PK')} per kg${priceChoice === 'suggested' ? ' (reference)' : ''}`} /><ReviewRow label="Pictures" value={`${photos.length} added`} /><ReviewRow label="Location" value={[village, city, province].filter(Boolean).join(', ')} /><ReviewRow label="Harvest date" value={harvestDate} />{readyDate && <ReviewRow label="Ready date" value={readyDate} />}{variety && <ReviewRow label="Variety" value={variety} />}<div>{field('Crop variety (optional)', <input className={inputClass} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. Super Kernel, Desi" />)}</div>{field('Crop quality', <div className="grid grid-cols-3 gap-2">{grades.map((g) => <button type="button" key={g} onClick={() => setGrade(g)} className={`rounded-xl border-2 px-2 py-3 text-base font-bold ${grade === g ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB] bg-white'}`}>{g}</button>)}</div>)}<p className="text-sm text-[#636E72]">When you save, this crop becomes visible in the farmer product feed and can receive offers from arhtis.</p></div>}
      </div>

      {state?.error && <div className="flex gap-2 rounded-xl bg-red-50 p-4 text-base text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />{state.error}</div>}
      <div className="flex gap-3 border-t border-[#E5E7EB] pt-5">{step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#D9E2DC] px-4 py-4 text-base font-bold text-charcoal"><ArrowLeft className="h-5 w-5" />Back</button>}{step < stepTitles.length - 1 ? <button type="button" disabled={!canContinue || uploading} onClick={() => setStep((s) => s + 1)} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-agri-900 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue<ArrowRight className="h-5 w-5" /></button> : <button type="submit" disabled={pending || uploading || !canContinue} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-agri-900 px-4 py-4 text-base font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{pending ? 'Saving your crop…' : 'Save my crop'}</button>}</div>
    </form>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] py-2"><span className="text-sm text-[#636E72]">{label}</span><span className="text-right text-base font-bold text-charcoal">{value}</span></div>; }
