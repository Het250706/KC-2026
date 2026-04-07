-- CREATE REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    age INTEGER,
    role TEXT,
    base_price BIGINT,
    mobile TEXT UNIQUE,
    city TEXT,
    photo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;

-- RLS Policies
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON registrations FOR SELECT USING (true);
CREATE POLICY "Service Role Full Access" ON registrations FOR ALL USING (true);
