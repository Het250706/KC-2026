import RoleGuard from '@/components/RoleGuard';

export default function CaptainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleGuard allowedRole="captain">
            {children}
        </RoleGuard>
    );
}
