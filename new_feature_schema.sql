CREATE TABLE er_teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE barangays (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE internal_reports (
    id SERIAL PRIMARY KEY,
    original_report_id UUID REFERENCES emergency_reports(id) NULL,
    incident_type_id INT NOT NULL REFERENCES incident_types(id),
    incident_date TIMESTAMPTZ NOT NULL,
    time_responded TIMESTAMPTZ,
    barangay_id INT NOT NULL REFERENCES barangays(id),
    er_team_id INT NOT NULL REFERENCES er_teams(id),
    persons_involved INT,
    number_of_responders INT,
    prepared_by TEXT NOT NULL,
    patient_name TEXT,
    patient_contact_number TEXT,
    patient_birthday DATE,
    patient_age INT,
    patient_address TEXT,
    patient_sex TEXT,
    evacuation_priority TEXT,
    emergency_category TEXT,
    airway_interventions TEXT,
    breathing_support TEXT,
    circulation_status TEXT,
    body_parts_front TEXT,
    body_parts_back TEXT,
    injury_types TEXT,
    incident_location TEXT,
    moi_poi_toi TEXT,
    receiving_hospital_name TEXT,
    receiving_hospital_date TIMESTAMPTZ,
    emt_ert_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep existing deployments in sync with the added patient, transfer, and body diagram fields
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_contact_number TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_birthday DATE;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_age INT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_address TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS patient_sex TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS evacuation_priority TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS emergency_category TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS airway_interventions TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS breathing_support TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS circulation_status TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS body_parts_front TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS body_parts_back TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS injury_types TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS incident_location TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS moi_poi_toi TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS receiving_hospital_name TEXT;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS receiving_hospital_date TIMESTAMPTZ;
ALTER TABLE internal_reports ADD COLUMN IF NOT EXISTS emt_ert_date TIMESTAMPTZ;

INSERT INTO er_teams (name) VALUES
('Team Alpha'),
('Team Charlie'),
('Team Bravo');

INSERT INTO incident_types (name) VALUES
('Armed Conflict'),
('Medical Emergency'),
('Vehicular/Pedestrian Roadcrash Incident'),
('Drowning Incident'),
('Others'),
('Water Mishop'),
('Fire Incident'),
('Vehicular/Pedestrian Accident'),
('Weather Disturbance');

INSERT INTO barangays (name) VALUES
('A. Bonifacio (Tinurilan)'),
('Abad Santos (Kambal)'),
('Aguinaldo (Lipata Dako)'),
('Antipolo'),
('Aquino (Imelda)'),
('Bical'),
('Beguin'),
('Bonga'),
('Butag'),
('Cadandanan'),
('Calomagon'),
('Calpi'),
('Cocok-Cabitan'),
('Daganas'),
('Danao'),
('Dolos'),
('E. Quirino (Pinangomhan)'),
('Fabrica'),
('G. Del Pilar (Tanga)'),
('Gate'),
('Inararan'),
('J. Gerona (Biton)'),
('J.P. Laurel (Pon-od)'),
('Jamorawon'),
('Libertad (Calle Putol)'),
('Lajong'),
('Magsaysay (Bongog)'),
('Managa-naga'),
('Marinab'),
('Nasuje'),
('Montecalvario'),
('N. Roque (Calayugan)'),
('Namo'),
('Obrero'),
('Osmeña (Lipata Saday)'),
('Otavi'),
('Padre Diaz'),
('Palale'),
('Quezon (Cabarawan)'),
('R. Gerona'),
('Recto'),
('Roxas (Busay)'),
('Sagrada'),
('San Francisco (Polot)'),
('San Isidro (Cabugaan)'),
('San Juan Bag-o'),
('San Juan Daan'),
('San Rafael (Togbongon)'),
('San Ramon'),
('San Vicente'),
('Sta. Remedios'),
('Sta. Teresita (Trece)'),
('Sigad'),
('Somagongsong'),
('Taromata'),
('Zone 1 (Ilawod)'),
('Zone 2 (Ilawod/Sabang)'),
('Zone 3 (Central)'),
('Zone 4 (Central)'),
('Zone 5 (Canipaan)'),
('Zone 6 (Baybay)'),
('Zone 7 (Iraya)'),
('Zone 8 (Loyo)');

-- 6. Enable RLS for the new tables (assuming you want to protect them)
ALTER TABLE er_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE barangays ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_reports ENABLE ROW LEVEL SECURITY;

-- 7. Create policies to allow admins to read/write these tables
-- (You might need to adjust the admin check to match your system)
CREATE POLICY "Allow admins full access to er_teams" ON er_teams FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to incident_types" ON incident_types FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to barangays" ON barangays FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Allow admins full access to internal_reports" ON internal_reports FOR ALL USING (auth.jwt()->>'role' = 'admin') WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Note: If you have a different way of identifying admins (e.g., a custom function), replace `auth.jwt()->>'role' = 'admin'` with your method.

