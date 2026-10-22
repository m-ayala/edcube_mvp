// Signup step 1: individual teacher or organization.
const cards = [
  { key: 'individual', title: "I'm a teacher exploring on my own", text: 'Start free. Create, plan and share your own courses.' },
  { key: 'organization', title: 'My school or organization', text: 'Bring EdCube to your team or staff.' }
];

const SignupChoice = ({ onChoose }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <style>{`
      .su-card { text-align: left; background: #fff; border: 0.5px solid #E5E0D8; border-radius: 18px;
        padding: 22px 24px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: border-color 0.18s, background 0.18s; }
      .su-card:hover { border-color: #1C1917; background: #FFFDF9; }
    `}</style>
    {cards.map((c) => (
      <button key={c.key} type="button" className="su-card" data-choice={c.key} onClick={() => onChoose(c.key)}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', color: '#1C1917', marginBottom: 6 }}>{c.title}</div>
        <div style={{ fontSize: 14, color: '#6B6459', lineHeight: 1.5 }}>{c.text}</div>
      </button>
    ))}
  </div>
);

export default SignupChoice;
