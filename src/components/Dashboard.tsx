import { Header } from './Header';
import { MapView } from './MapView';

export function Dashboard() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <MapView />
      </div>
    </div>
  );
}
