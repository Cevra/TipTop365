// Launch contract templates (E7.1, plan §8). LAWYER-OWNED CONTENT: every
// template renders with the DRAFT watermark until an admin flips
// lawyer_approved (CLAUDE.md guardrail) — the texts below are structural
// skeletons for the workflow, NOT legal advice, and must be reviewed before
// launch. Placeholders use {{token}} — E7.2's renderer substitutes them.

import type { ContractTemplateRegime } from '@prisma/client';

export const WATERMARK_HTML =
  '<div class="draft-watermark">NACRT — ZAHTIJEVA PRAVNU REVIZIJU / DRAFT — REQUIRES LEGAL REVIEW</div>';

export const PLACEHOLDERS = [
  'bookingCode',
  'customerName',
  'cleanerName',
  'cleanerJmbg',
  'jobDescription',
  'dates',
  'compensationKM',
  'contributionNote',
  'cityDate',
] as const;

interface TemplateDef {
  key: string;
  legalRegime: ContractTemplateRegime;
  lang: 'bs' | 'en';
  htmlBody: string;
}

function tempWorkBody(args: { lang: 'bs' | 'en'; title: string; law: string; limit: string }): string {
  if (args.lang === 'bs') {
    return `${WATERMARK_HTML}
<h1>${args.title}</h1>
<p>zaključen na osnovu ${args.law}, između:</p>
<ol>
  <li><strong>Naručilac:</strong> {{customerName}} (rezervacija {{bookingCode}})</li>
  <li><strong>Izvršilac:</strong> {{cleanerName}}, JMBG: {{cleanerJmbg}}</li>
</ol>
<h2>Član 1 — Predmet</h2>
<p>Izvršilac se obavezuje obaviti privremene i povremene poslove čišćenja: {{jobDescription}}, u terminima: {{dates}}.</p>
<h2>Član 2 — Naknada</h2>
<p>Naknada za obavljeni posao iznosi {{compensationKM}}. {{contributionNote}}</p>
<h2>Član 3 — Ograničenje angažmana</h2>
<p>Angažman po ovom ugovoru ograničen je na ${args.limit} u kalendarskoj godini, u skladu sa zakonom.</p>
<h2>Član 4 — Ostalo</h2>
<p>Na sve što nije uređeno ovim ugovorom primjenjuju se odredbe važećih propisa. Ugovor je zaključen elektronskim prihvatom obje strane putem platforme TipTop365.</p>
<p>{{cityDate}}</p>`;
  }
  return `${WATERMARK_HTML}
<h1>${args.title}</h1>
<p>concluded under ${args.law}, between:</p>
<ol>
  <li><strong>Client:</strong> {{customerName}} (booking {{bookingCode}})</li>
  <li><strong>Contractor:</strong> {{cleanerName}}, ID no.: {{cleanerJmbg}}</li>
</ol>
<h2>Article 1 — Subject</h2>
<p>The contractor undertakes temporary and occasional cleaning work: {{jobDescription}}, on: {{dates}}.</p>
<h2>Article 2 — Compensation</h2>
<p>The compensation amounts to {{compensationKM}}. {{contributionNote}}</p>
<h2>Article 3 — Engagement limit</h2>
<p>Engagement under this contract is limited to ${args.limit} per calendar year, as provided by law.</p>
<h2>Article 4 — Miscellaneous</h2>
<p>Matters not regulated here are governed by applicable law. The contract is concluded by electronic acceptance of both parties via the TipTop365 platform.</p>
<p>{{cityDate}}</p>`;
}

function selfBillBody(lang: 'bs' | 'en'): string {
  if (lang === 'bs') {
    return `${WATERMARK_HTML}
<h1>Samofakturisanje — obračun usluge</h1>
<p>Izdaje TipTop365 u ime izvršioca (registrovani obrt), u skladu sa dogovorom o samofakturisanju.</p>
<ul>
  <li><strong>Obrt:</strong> {{cleanerName}}, ID: {{cleanerJmbg}}</li>
  <li><strong>Usluga:</strong> {{jobDescription}} ({{bookingCode}})</li>
  <li><strong>Termini:</strong> {{dates}}</li>
  <li><strong>Iznos:</strong> {{compensationKM}}</li>
</ul>
<p>{{contributionNote}}</p>
<p>{{cityDate}}</p>`;
  }
  return `${WATERMARK_HTML}
<h1>Self-billing — service statement</h1>
<p>Issued by TipTop365 on behalf of the contractor (registered trade), under a self-billing arrangement.</p>
<ul>
  <li><strong>Trade:</strong> {{cleanerName}}, ID: {{cleanerJmbg}}</li>
  <li><strong>Service:</strong> {{jobDescription}} ({{bookingCode}})</li>
  <li><strong>Dates:</strong> {{dates}}</li>
  <li><strong>Amount:</strong> {{compensationKM}}</li>
</ul>
<p>{{contributionNote}}</p>
<p>{{cityDate}}</p>`;
}

const REGIME_META: Record<Exclude<ContractTemplateRegime, 'obrt_selfbill'>, { lawBs: string; lawEn: string; limitBs: string; limitEn: string }> = {
  fbih: {
    lawBs: 'člana 166. Zakona o radu FBiH',
    lawEn: 'Article 166 of the FBiH Labour Law',
    limitBs: '60 dana',
    limitEn: '60 days',
  },
  fbih_student: {
    lawBs: 'člana 166a. Zakona o radu FBiH (studentski angažman)',
    lawEn: 'Article 166a of the FBiH Labour Law (student engagement)',
    limitBs: '180 dana i najviše 2 ugovora',
    limitEn: '180 days and at most 2 contracts',
  },
  rs: {
    lawBs: 'člana 204. Zakona o radu Republike Srpske',
    lawEn: 'Article 204 of the RS Labour Law',
    limitBs: '90 radnih dana',
    limitEn: '90 working days',
  },
  brcko: {
    lawBs: 'propisa Brčko distrikta o privremenim i povremenim poslovima',
    lawEn: 'Brčko District regulations on temporary and occasional work',
    limitBs: '60 dana (konfigurabilno)',
    limitEn: '60 days (configurable)',
  },
};

export function launchTemplates(): TemplateDef[] {
  const defs: TemplateDef[] = [];
  for (const regime of ['fbih', 'fbih_student', 'rs', 'brcko'] as const) {
    const meta = REGIME_META[regime];
    defs.push({
      key: 'temp_work',
      legalRegime: regime,
      lang: 'bs',
      htmlBody: tempWorkBody({
        lang: 'bs',
        title: 'Ugovor o obavljanju privremenih i povremenih poslova',
        law: meta.lawBs,
        limit: meta.limitBs,
      }),
    });
    defs.push({
      key: 'temp_work',
      legalRegime: regime,
      lang: 'en',
      htmlBody: tempWorkBody({
        lang: 'en',
        title: 'Contract for temporary and occasional work',
        law: meta.lawEn,
        limit: meta.limitEn,
      }),
    });
  }
  defs.push({ key: 'self_bill', legalRegime: 'obrt_selfbill', lang: 'bs', htmlBody: selfBillBody('bs') });
  defs.push({ key: 'self_bill', legalRegime: 'obrt_selfbill', lang: 'en', htmlBody: selfBillBody('en') });
  return defs;
}
