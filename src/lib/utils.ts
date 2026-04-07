export function fixPhotoUrl(url: string | null | undefined, name: string = 'player'): string {
    if (!url || url.trim() === '') {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    }

    const lowerUrl = url.toLowerCase();

    // 1. Handle Supabase Storage URLs (return as is)
    if (lowerUrl.includes('.supabase.co')) {
        return url;
    }

    // 2. Handle Google Drive and UserContent - wrap in proxy
    if (lowerUrl.includes('lh3.googleusercontent.com') ||
        lowerUrl.includes('googleusercontent.com') ||
        lowerUrl.includes('drive.google.com') ||
        lowerUrl.includes('docs.google.com')) {

        // Extract ID and normalize to the canonical format if it's a Drive link
        const fileIdMatch = url.match(/[-\w]{25,}/);
        let finalUrl = url;
        if (fileIdMatch && (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com'))) {
            finalUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
        }

        return `/api/proxy-image?url=${encodeURIComponent(finalUrl)}`;
    }

    // 3. Fallback for other images
    return url;
}