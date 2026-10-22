import { useState } from 'react';
import { movementLanguages } from '@/lib/project-scripts';

export function ScriptCreate({ onCreate }: { onCreate: (language: string) => void }) {
  const [language, setLanguage] = useState('JavaScript');
  return (
    <div className="script-create">
      <label className="script-run-label" htmlFor="new-script-language">New script language</label>
      <select id="new-script-language" className="project-dropdown" value={language} onChange={(event) => setLanguage(event.target.value)}>
        {movementLanguages.map(({ language }) => <option key={language}>{language}</option>)}
      </select>
      <button type="button" onClick={() => onCreate(language)}>Create script</button>
      <small>Starts with a player movement example. Creating or editing never runs code.</small>
    </div>
  );
}
