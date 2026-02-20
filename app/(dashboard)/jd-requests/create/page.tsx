import { getCurrentUser } from '@/api/utils/auth';
import { JDRequestCreateClient } from './JDRequestCreateClient';

export default async function JDRequestCreatePage() {
  const user = await getCurrentUser();

  return (
    <JDRequestCreateClient />
  );
}
