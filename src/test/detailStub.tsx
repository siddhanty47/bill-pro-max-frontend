import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** A detail page stand-in: shows its route param and keeps one piece of local state. */
export function stub(param: string) {
  return function DetailStub() {
    const id = useParams()[param];
    const navigate = useNavigate();
    const [marked, setMarked] = useState(false);
    return (
      <div>
        <output data-testid="id">{id}</output>
        <output data-testid="marked">{marked ? 'yes' : 'no'}</output>
        <button onClick={() => setMarked(true)}>mark</button>
        <button onClick={() => navigate(`../x2`, { relative: 'path', replace: true })}>step</button>
      </div>
    );
  };
}
