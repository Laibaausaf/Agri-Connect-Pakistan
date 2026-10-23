'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon, { type IconName } from '@/components/ui/Icon';

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
const inputClass = 'field-input text-lg';
const stepKeys = ['wizard.step0', 'wizard.step1', 'wizard.step2', 'wizard.step3', 'wizard.step4', 'wizard.step5'] as const;

export default function FarmerCropWizard({ action, crops, priceByCrop, defaults }: Props) {
  const { t, crop: cropName, place, grade: gradeName, kg, rate, date, error: errorText, status } = useI18n();
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

  const field = (label: string, content: ReactNode, hint?: string, icon?: IconName) => (
    <label className="block">
      <span className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
        {icon && <Icon name={icon} size={18} className="text-forest" />}
        {label}
      </span>
      {content}
      {hint && <span className="mt-2 block text-sm text-muted">{hint}</span>}
    </label>
  );
  const chosenPrice = Number(priceChoice === 'suggested' ? suggestedPrice : price);
  const shortDate = (value: string) => date(`${value}T00:00:00`, { day: 'numeric', month: 'long', year: 'numeric' });
  const priceText =
    priceChoice === 'offers'
      ? t('wizard.buyersOffer')
      : priceChoice === 'suggested'
        ? t('wizard.reference', { price: t('wizard.perKg', { amount: rate(chosenPrice) }) })
        : t('wizard.perKg', { amount: rate(chosenPrice) });
  const choice = (selected: boolean, onClick: () => void, title: string, hint: string, extra?: ReactNode) => (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] p-4 text-start transition ${
        selected ? 'border-gold bg-sage' : 'border-line bg-sf hover:border-forest'
      }`}
    >
      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-gold' : 'border-line'}`}>
        {selected && <span className="h-3 w-3 rounded-full bg-gold" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{title}</span>
        {extra}
        <span className="mt-1 block text-sm text-muted">{hint}</span>
      </span>
    </div>
  );

  // Live preview of the listing: what arhtis will see once it is saved.
  const preview = (
    <div className="card overflow-hidden">
      <div className="h-32 bg-sage">
        {photos[0] || selectedCrop?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0] ?? selectedCrop?.imageUrl ?? ''} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-forest">
            <Icon name="sprout" size={40} />
          </span>
        )}
      </div>
      <div className="p-4">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ok-bg px-2.5 text-[12.5px] font-bold text-ok-fg">
          <Icon name="checkcircle" size={15} />
          {status('READY_FOR_SALE')}
        </span>
        <div className="mt-2 text-[17px] font-bold">
          {selectedCrop ? cropName(selectedCrop) : t('wizard.thisCrop')}
          {Number(quantity) > 0 && ` · ${kg(Number(quantity))}`}
        </div>
        <div className="tabular text-xl font-extrabold">{cropId ? priceText : '—'}</div>
        <div className="mt-1 text-[13px] text-muted">
          {place([village, city].filter(Boolean).join(', '))} · {gradeName(grade)}
          {harvestDate && ` · ${shortDate(harvestDate)}`}
        </div>
      </div>
    </div>
  );

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:items-start">
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

      {/* Steps (desktop). Earlier steps can be reopened, like pressing Back. */}
      <ol className="hidden space-y-1 lg:block" aria-label={t('wizard.stepsLabel')}>
        {stepTitles.map((title, i) => (
          <li key={title}>
            <button
              type="button"
              disabled={i >= step}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] disabled:cursor-default ${
                i === step ? 'bg-sf font-extrabold shadow-card' : i < step ? 'font-semibold hover:bg-sage' : 'font-semibold text-muted'
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                  i < step ? 'bg-gold text-ongold' : i === step ? 'bg-forest text-paper' : 'border-2 border-line'
                }`}
              >
                {i < step ? <Icon name="check" size={15} stroke={3} /> : i + 1}
              </span>
              <span className="min-w-0 leading-snug">{t(`wizard.short${i}` as 'wizard.short0')}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="card min-w-0 p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between text-sm font-bold text-muted">
          <span>{t('wizard.stepOf', { step: step + 1, total: stepTitles.length })}</span>
          <span>{t('wizard.complete', { percent: Math.round(progress) })}</span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {stepTitles.map((title, i) => (
            <span key={title} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-sage'}`} />
          ))}
        </div>

        <div className="mt-6 min-h-[330px]">
          <h2 className="font-display h-section font-semibold">{stepTitles[step]}</h2>
          <p className="mb-6 mt-1.5 text-base text-muted">{t(`${stepKeys[step]}.hint`)}</p>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {crops.map((crop) => {
                const selected = cropId === crop.id;
                return (
                  <button
                    type="button"
                    key={crop.id}
                    aria-pressed={selected}
                    onClick={() => { setCropId(crop.id); setPriceChoice(priceByCrop[crop.id] === undefined ? 'offers' : 'suggested'); setPrice(''); }}
                    className={`ac-press relative overflow-hidden rounded-2xl border-[1.5px] text-start transition ${selected ? 'border-gold ring-2 ring-gold' : 'border-line hover:border-forest'}`}
                  >
                    <span className="flex h-24 items-center justify-center bg-sage text-forest">
                      {crop.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={crop.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon name="sprout" size={34} />
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2 bg-sf px-3 py-3">
                      <span className="text-base font-bold">{cropName(crop)}</span>
                      {selected && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold text-ongold">
                          <Icon name="check" size={14} stroke={3} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {field(
                t('wizard.qtyLabel'),
                <span className="relative block">
                  <input className={`${inputClass} pe-14 tabular`} type="number" inputMode="decimal" min="1" max="500000" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('wizard.qtyPlaceholder')} autoFocus />
                  <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-base font-bold text-muted">{t('wizard.kgUnit')}</span>
                </span>,
                t('wizard.qtyHint')
              )}
              {quantity && Number(quantity) > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-sage p-4">
                  <Icon name="checkcircle" size={24} className="text-forest" />
                  <span className="text-lg font-bold">{t('wizard.qtyAmount', { amount: kg(Number(quantity)) })}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3" role="radiogroup" aria-label={stepTitles[2]}>
              {suggestedPrice !== undefined &&
                choice(
                  priceChoice === 'suggested',
                  () => setPriceChoice('suggested'),
                  t('wizard.suggested'),
                  t('wizard.suggestedNote'),
                  <span className="tabular mt-1 block text-2xl font-extrabold">{t('wizard.perKg', { amount: rate(suggestedPrice) })}</span>
                )}
              {suggestedPrice === undefined && (
                <div className="flex items-start gap-2 rounded-2xl bg-warn-bg p-4 text-base text-warn-fg">
                  <Icon name="info" size={20} className="mt-0.5" />
                  {t('wizard.noSuggested', { crop: selectedCrop ? cropName(selectedCrop) : t('wizard.thisCrop') })}
                </div>
              )}
              {choice(
                priceChoice === 'custom',
                () => setPriceChoice('custom'),
                t('wizard.ownPrice'),
                t('wizard.ownPriceHint'),
                priceChoice === 'custom' && (
                  <input className={`${inputClass} mt-3`} type="number" min="1" step="0.5" value={price} onClick={(e) => e.stopPropagation()} onChange={(e) => setPrice(e.target.value)} placeholder={t('wizard.ownPricePlaceholder')} />
                )
              )}
              {choice(priceChoice === 'offers', () => setPriceChoice('offers'), t('wizard.offers'), t('wizard.offersHint'))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border-[1.5px] border-dashed border-line bg-paper p-6 text-center">
                <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-sage text-forest">
                  <Icon name="camera" size={30} />
                </span>
                <h3 className="text-lg font-bold">{t('wizard.photoTitle')}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{t('wizard.photoHint')}</p>
                <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-start text-sm">
                  {(['wizard.tip1', 'wizard.tip2', 'wizard.tip3'] as const).map((tip) => (
                    <li key={tip} className="flex items-start gap-2">
                      <Icon name="checkcircle" size={16} className="mt-0.5 text-forest" />
                      {t(tip)}
                    </li>
                  ))}
                </ul>
                <label className="btn mt-5 cursor-pointer bg-forest px-5 text-paper">
                  <Icon name="upload" size={20} />
                  {uploading ? t('wizard.uploading') : t('wizard.choosePhotos')}
                  <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple capture="environment" disabled={uploading || photos.length >= 5} className="sr-only" onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ''; }} />
                </label>
                <p className="mt-3 text-[13px] text-muted">{t('wizard.photoRules')}</p>
              </div>
              {uploadError && (
                <p role="alert" className="flex items-start gap-2 rounded-2xl bg-err-bg p-3 text-sm font-semibold text-err-fg">
                  <Icon name="alert" size={18} className="mt-0.5" />
                  {uploadError}
                </p>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <div key={photo} className="relative overflow-hidden rounded-2xl border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={t('wizard.photoAlt')} className="h-32 w-full object-cover" />
                      <button type="button" onClick={() => setPhotos((current) => current.filter((p) => p !== photo))} className="absolute end-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sf text-err-fg shadow-card" aria-label={t('wizard.removePhoto')}>
                        <Icon name="x" size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {field(t('wizard.village'), <input className={inputClass} value={village} onChange={(e) => setVillage(e.target.value)} placeholder={t('wizard.villagePlaceholder')} />, undefined, 'home')}
              {field(t('wizard.city'), <input required minLength={2} className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('wizard.cityPlaceholder')} />, undefined, 'pin')}
              {field(t('wizard.province'), <select className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)}>{provinces.map((p) => <option key={p} value={p}>{place(p)}</option>)}</select>, undefined, 'flag')}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {field(t('wizard.harvestDate'), <input className={inputClass} type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} required />, undefined, 'calendar')}
                {field(t('wizard.readyDate'), <input className={inputClass} type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} />, undefined, 'calendar')}
              </div>
              {field(t('wizard.packaging'), <input className={inputClass} value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder={t('wizard.packagingPlaceholder')} />, undefined, 'package')}
              {field(t('wizard.notes'), <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('wizard.notesPlaceholder')} />, undefined, 'message')}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-line">
                {selectedCrop && (
                  <div className="flex items-center gap-3 bg-sage p-4">
                    {selectedCrop.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedCrop.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    ) : (
                      <Icon name="sprout" size={40} className="text-forest" />
                    )}
                    <div>
                      <div className="text-xl font-extrabold">{cropName(selectedCrop)}</div>
                      <div className="text-sm text-muted">{t('wizard.yourListing')}</div>
                    </div>
                  </div>
                )}
                <ReviewRow label={t('wizard.rowQuantity')} value={kg(Number(quantity))} onChange={() => setStep(1)} changeLabel={t('wizard.change')} />
                <ReviewRow label={t('wizard.rowPrice')} value={priceText} onChange={() => setStep(2)} changeLabel={t('wizard.change')} />
                <ReviewRow label={t('wizard.rowPictures')} value={t('wizard.picturesAdded', { count: photos.length })} onChange={() => setStep(3)} changeLabel={t('wizard.change')} />
                <ReviewRow label={t('wizard.rowLocation')} value={place([village, city, province].filter(Boolean).join(', '))} onChange={() => setStep(4)} changeLabel={t('wizard.change')} />
                <ReviewRow label={t('wizard.rowHarvest')} value={shortDate(harvestDate)} onChange={() => setStep(4)} changeLabel={t('wizard.change')} />
                {readyDate && <ReviewRow label={t('wizard.rowReady')} value={shortDate(readyDate)} onChange={() => setStep(4)} changeLabel={t('wizard.change')} />}
                {variety && <ReviewRow label={t('wizard.rowVariety')} value={variety} />}
              </div>
              {field(t('wizard.variety'), <input className={inputClass} value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={t('wizard.varietyPlaceholder')} />)}
              {field(
                t('wizard.quality'),
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {grades.map((g) => (
                    <button type="button" key={g} role="radio" aria-checked={grade === g} onClick={() => setGrade(g)} className={`min-h-12 rounded-xl border-[1.5px] px-2 text-base font-bold ${grade === g ? 'border-gold bg-sage' : 'border-line bg-sf'}`}>
                      {gradeName(g)}
                    </button>
                  ))}
                </div>
              )}
              <p className="flex items-start gap-2 rounded-2xl bg-info-bg p-3 text-sm text-info-fg">
                <Icon name="info" size={18} className="mt-0.5" />
                {t('wizard.saveNote')}
              </p>
            </div>
          )}
        </div>

        {state?.error && (
          <div role="alert" className="ac-shake mt-4 flex gap-2 rounded-2xl bg-err-bg p-4 text-base font-semibold text-err-fg">
            <Icon name="alert" size={20} className="mt-0.5" />
            {errorText(state.error)}
          </div>
        )}
        <div className="mt-6 flex gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <button type="button" data-wizard="back" onClick={() => setStep((s) => s - 1)} className="btn btn-outline flex-1">
              <Icon name="arrowleft" size={20} />
              {t('wizard.back')}
            </button>
          ) : (
            <Link href="/crops" className="btn btn-outline flex-1">
              <Icon name="x" size={20} />
              {t('wizard.cancel')}
            </Link>
          )}
          {step < stepTitles.length - 1 ? (
            <button type="button" data-wizard="continue" disabled={!canContinue || uploading} onClick={() => setStep((s) => s + 1)} className="btn btn-primary flex-[2]">
              {t('wizard.continue')}
              <Icon name="arrowright" size={20} />
            </button>
          ) : (
            <button type="submit" data-wizard="save" disabled={pending || uploading || !canContinue} className="btn btn-primary flex-[2]">
              <Icon name={pending ? 'refresh' : 'checkcircle'} size={20} className={pending ? 'animate-spin' : ''} />
              {pending ? t('wizard.saving') : t('wizard.save')}
            </button>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-muted">{t('wizard.previewTitle')}</div>
        {preview}
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
          <Icon name="eye" size={15} />
          {t('wizard.previewNote')}
        </p>
      </aside>
    </form>
  );
}
function ReviewRow({ label, value, onChange, changeLabel }: { label: string; value: string; onChange?: () => void; changeLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block text-base font-bold">{value}</span>
      </span>
      {onChange && (
        <button type="button" onClick={onChange} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-bold text-forest hover:bg-sage">
          <Icon name="edit" size={15} />
          {changeLabel}
        </button>
      )}
    </div>
  );
}
