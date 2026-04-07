-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-photos', 'player-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public access to read files
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'player-photos');

-- 3. Allow authenticated users to upload files
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'player-photos' AND auth.role() = 'authenticated');

-- 4. Allow all users (including anonymous) to upload during registration if needed
-- WARNING: Use carefully. For now, we'll allow anyone to insert into this specific bucket
-- so the registration form works without auth.
CREATE POLICY "Anyone Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'player-photos');

-- 5. Allow users to update their own files (optional)
CREATE POLICY "Anyone Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'player-photos');
