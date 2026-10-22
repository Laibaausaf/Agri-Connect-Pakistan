'use client';

import { useActionState, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, Sprout, Trash2, UploadCloud } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n/LanguageProvider';

type CropOption = { id: string; name: string; nameUrdu: string | null; imageUrl: string | null };
type Props = {
  action: (formData: FormData) => Promise<{ error?: string } | null | undefined | void>;
  crops: CropOption[];
  priceByCrop: Record<string, number>;
  defaults: { village: string; city: string; province: string; today: string };
};
// Submitted values stay in English; only the displayed text is translated.
const provinces = ['Khyber Pakhtunkhwa', 'Punjab', 'Sindh', 'Balochistan', 'Islamabad Capital Territory'];
const grades = ['Grade A', 'Grade B', 'Grade C'];
const inputClass = 'w-full rounded-2xl border-2 border-[#D9E2DC] bg-white px-4 py-4 text-lg text-charcoal outline-none focus:border-agri-700 focus:ring-2 focus:ring-[#B7D4C8]';
const stepKeys = ['wizard.step0', 'wizard.step1', 'wizard.step2', 'wizard.step3', 'wizard.step4', 'wizard.step5'] as const;

export default function FarmerCropWizard({ action, crops, priceByCrop, defaults }: Props) {
  const { t, crop: cropName, place, grade: gradeName, kg, rate, date, error: errorText } = useI18n();
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
  const stepTitles = stepKeys.map((key) => t(`${key}.title`));
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
    if (accepted.length !== fileList.length) setUploadError(t('wizard.errType'));
    if (!accepted.length) return;
    if (photos.length + accepted.length > 5) { setUploadError(t('wizard.errMax')); return; }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of accepted) {
        if (file.size > 8 * 1024 * 1024) throw new Error(t('wizard.errSize', { file: file.name }));
        const body = new FormData(); body.append('file', file);
        const response = await fetch('/api/crop-photos/upload', { method: 'POST', body });
        const result = await response.json();
        if (!response.ok || !result.url) throw new Error(result.error ? errorText(result.error) : t('wizard.errUpload'));
        uploaded.push(result.url as string);
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t('wizard.errUploadFailed'));
    } finally { setUploading(false); }
  }

  const field = (label: string, content: ReactNode, hint?: string) => <label className="block"><span className="mb-2 block text-base font-bold text-charcoal">{label}</span>{content}{hint && <span className="mt-2 block text-sm text-[#636E72]">{hint}</span>}</label>;
  const chosenPrice = Number(priceChoice === 'suggested' ? suggestedPrice : price);
  const shortDate = (value: string) => date(`${value}T00:00:00`, { day: 'numeric', month: 'long', year: 'numeric' });

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
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#636E72]"><span>{t('wizard.stepOf', { step: step + 1, total: stepTitles.length })}</span><span>{t('wizard.complete', { percent: Math.round(progress) })}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#E8EEE9]"><div className="h-full rounded-full bg-agri-900 transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="min-h-[330px]">
        <h2 className="mb-2 text-2xl font-extrabold leading-tight text-charcoal">{stepTitles[step]}</h2>
        <p className="mb-6 text-base text-[#636E72]">{t(`${stepKeys[step]}.hint`)}</p>

        {step === 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{crops.map((crop) => <button type="button" key={crop.id} onClick={() => { setCropId(crop.id); setPriceChoice(priceByCrop[crop.id] === undefined ? 'offers' : 'suggested'); setPrice(''); }} className={`rounded-2xl border-2 p-4 text-start transition ${cropId === crop.id ? 'border-agri-900 bg-[#E8F3EE] ring-2 ring-[#B7D4C8]' : 'border-[#E5E7EB] hover:border-[#B7D4C8]'}`}><span className="mb-3 flex h-16 items-center justify-center rounded-xl bg-[#F5F7F3]"><Sprout className="h-8 w-8 text-agri-900" /></span><span className="block text-base font-bold">{cropName(crop)}</span></button>)}</div>}

        {step === 1 && <div className="space-y-4">{field(t('wizard.qtyLabel'), <input className={inputClass} type="number" inputMode="decimal" min="1" max="500000" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('wizard.qtyPlaceholder')} autoFocus />, t('wizard.qtyHint'))}{quantity && Number(quantity) > 0 && <div className="rounded-2xl bg-[#E8F3EE] p-4 text-lg font-semibold text-agri-900">{t('wizard.qtyAmount', { amount: kg(Number(quantity)) })}</div>}</div>}

        {step === 2 && <div className="space-y-3">{suggestedPrice !== undefined && <button type="button" onClick={() => setPriceChoice('suggested')} className={`w-full rounded-2xl border-2 p-4 text-start ${priceChoice === 'suggested' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">{t('wizard.suggested')}</span><span className="mt-1 block text-xl font-extrabold text-agri-900">{t('wizard.perKg', { amount: rate(suggestedPrice) })}</span><span className="mt-1 block text-sm text-[#636E72]">{t('wizard.suggestedNote')}</span></button>}{suggestedPrice === undefined && <div className="rounded-2xl bg-amber-50 p-4 text-base text-amber-900">{t('wizard.noSuggested', { crop: selectedCrop ? cropName(selectedCrop) : t('wizard.thisCrop') })}</div>}<button type="button" onClick={() => setPriceChoice('custom')} className={`w-full rounded-2xl border-2 p-4 text-start ${priceChoice === 'custom' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">{t('wizard.ownPrice')}</span><span className="mt-1 block text-sm text-[#636E72]">{t('wizard.ownPriceHint')}</span>{priceChoice === 'custom' && <input className={`${inputClass} mt-3`} type="number" min="1" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('wizard.ownPricePlaceholder')} />}</button><button type="button" onClick={() => setPriceChoice('offers')} className={`w-full rounded-2xl border-2 p-4 text-start ${priceChoice === 'offers' ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB]'}`}><span className="block text-lg font-bold">{t('wizard.offers')}</span><span className="mt-1 block text-sm text-[#636E72]">{t('wizard.offersHint')}</span></button></div>}

        {step === 3 && <div className="space-y-4"><div className="rounded-2xl border-2 border-dashed border-[#B7D4C8] bg-[#F8FAF7] p-6 text-center"><span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F3EE]"><ImagePlus className="h-8 w-8 text-agri-900" /></span><h3 className="text-lg font-bold">{t('wizard.photoTitle')}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#636E72]">{t('wizard.photoHint')}</p><label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-agri-900 px-5 py-3 text-base font-bold text-white"><UploadCloud className="h-5 w-5" />{uploading ? t('wizard.uploading') : t('wizard.choosePhotos')}<input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple capture="environment" disabled={uploading || photos.length >= 5} className="sr-only" onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ''; }} /></label><p className="mt-3 text-xs text-[#636E72]">{t('wizard.photoRules')}</p></div>{uploadError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{uploadError}</p>}{photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo) => <div key={photo} className="relative overflow-hidden rounded-xl border border-[#E5E7EB]"><img src={photo} alt={t('wizard.photoAlt')} className="h-32 w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((p) => p !== photo))} className="absolute end-2 top-2 rounded-full bg-white p-2 text-red-700 shadow" aria-label={t('wizard.removePhoto')}><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div>}

        {step === 4 && <div className="space-y-5">{field(t('wizard.village'), <input className={inputClass} value={village} onChange={(e) => setVillage(e.target.value)} placeholder={t('wizard.villagePlaceholder')} />)}{field(t('wizard.city'), <input required minLength={2} className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('wizard.cityPlaceholder')} />)}{field(t('wizard.province'), <select className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)}>{provinces.map((p) => <option key={p} value={p}>{place(p)}</option>)}</select>)}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{field(t('wizard.harvestDate'), <input className={inputClass} type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} required />)}{field(t('wizard.readyDate'), <input className={inputClass} type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} />)}</div>{field(t('wizard.packaging'), <input className={inputClass} value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder={t('wizard.packagingPlaceholder')} />)}{field(t('wizard.notes'), <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('wizard.notesPlaceholder')} />)}</div>}

        {step === 5 && <div className="space-y-3 rounded-2xl bg-[#F8FAF7] p-4">{selectedCrop && <div className="flex items-center gap-3 rounded-xl bg-white p-3">{selectedCrop.imageUrl ? <img src={selectedCrop.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <Sprout className="h-10 w-10 text-agri-900" />}<div><div className="text-xl font-extrabold">{cropName(selectedCrop)}</div><div className="text-sm text-[#636E72]">{t('wizard.yourListing')}</div></div></div>}<ReviewRow label={t('wizard.rowQuantity')} value={kg(Number(quantity))} /><ReviewRow label={t('wizard.rowPrice')} value={priceChoice === 'offers' ? t('wizard.buyersOffer') : priceChoice === 'suggested' ? t('wizard.reference', { price: t('wizard.perKg', { amount: rate(chosenPrice) }) }) : t('wizard.perKg', { amount: rate(chosenPrice) })} /><ReviewRow label={t('wizard.rowPictures')} value={t('wizard.picturesAdded', { count: photos.length })} /><ReviewRow label={t('wizard.rowLocation')} value={place([village, city, province].filter(Boolean).join(', '))} /><ReviewRow label={t('wizard.rowHarvest')} value={shortDate(harvestDate)} />{readyDate && <ReviewRow label={t('wizard.rowReady')} value={shortDate(readyDate)} />}{variety && <ReviewRow label={t('wizard.rowVariety')} value={variety} />}<div>{field(t('wizard.variety'), <input className={inputClass} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={t('wizard.varietyPlaceholder')} />)}</div>{field(t('wizard.quality'), <div className="grid grid-cols-3 gap-2">{grades.map((g) => <button type="button" key={g} onClick={() => setGrade(g)} className={`rounded-xl border-2 px-2 py-3 text-base font-bold ${grade === g ? 'border-agri-900 bg-[#E8F3EE]' : 'border-[#E5E7EB] bg-white'}`}>{gradeName(g)}</button>)}</div>)}<p className="text-sm text-[#636E72]">{t('wizard.saveNote')}</p></div>}
      </div>

      {state?.error && <div className="flex gap-2 rounded-xl bg-red-50 p-4 text-base text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />{errorText(state.error)}</div>}
      <div className="flex gap-3 border-t border-[#E5E7EB] pt-5">{step > 0 && <button type="button" onClick={() => setStep((s) => s - 1)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#D9E2DC] px-4 py-4 text-base font-bold text-charcoal"><ArrowLeft className="h-5 w-5 rtl:-scale-x-100" />{t('wizard.back')}</button>}{step < stepTitles.length - 1 ? <button type="button" disabled={!canContinue || uploading} onClick={() => setStep((s) => s + 1)} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-agri-900 px-4 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{t('wizard.continue')}<ArrowRight className="h-5 w-5 rtl:-scale-x-100" /></button> : <button type="submit" disabled={pending || uploading || !canContinue} className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-agri-900 px-4 py-4 text-base font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{pending ? t('wizard.saving') : t('wizard.save')}</button>}</div>
    </form>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] py-2"><span className="text-sm text-[#636E72]">{label}</span><span className="text-end text-base font-bold text-charcoal">{value}</span></div>; }
