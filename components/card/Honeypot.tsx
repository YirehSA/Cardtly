// The field people never see and form-filling bots fill in (lib/lead-guard).
//
// Off-screen rather than display:none, because some bots skip fields that are
// not displayed. Hidden from screen readers and from the tab order, so nobody
// using the form meets it. Named like something no browser or password
// manager autofills: an autofilled trap would quietly drop a real lead, which
// is the one mistake this must never make.

export default function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Leave this empty
        <input type="text" name="contact_me_by_fax_only" tabIndex={-1} autoComplete="off"
          value={value} onChange={e => onChange(e.target.value)} />
      </label>
    </div>
  )
}
