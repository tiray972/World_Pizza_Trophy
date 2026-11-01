import App from "./world-pizza-trophy-admin/App";
import { AdminGate } from "./world-pizza-trophy-admin/components/AdminGate";

export default function Dashboard() {
    return (
        <AdminGate>
            <App></App>
        </AdminGate>
    );
}
