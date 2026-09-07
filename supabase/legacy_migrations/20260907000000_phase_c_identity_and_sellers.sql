-- 0. Security helper functions supporting single or double parameter signatures
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND (role::text LIKE 'admin_%' OR role::text = 'admin' OR role::text = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_seller_member(seller_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.sellers WHERE id = seller_uuid AND owner_id = user_uuid
    ) OR EXISTS (
        SELECT 1 FROM public.seller_staff WHERE seller_id = seller_uuid AND user_id = user_uuid AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Automatic User Profile Provisioning Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        'customer'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Seller Agreements Acceptance Log (§4, T041)
CREATE TABLE IF NOT EXISTS public.seller_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    agreement_type TEXT NOT NULL DEFAULT 'SELLER_TERMS_AND_CONDITIONS', -- SELLER_TERMS_AND_CONDITIONS, PRIVACY_POLICY, COMMISSION_AGREEMENT
    version TEXT NOT NULL DEFAULT 'V1_2026',
    ip_address TEXT,
    user_agent TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seller Documents & Verification Metadata (§4, T042)
CREATE TYPE document_verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS public.seller_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- ABN_CERTIFICATE, ID_PROOF, BANK_STATEMENT, BUSINESS_REGISTRATION
    file_path TEXT NOT NULL, -- Path inside private Supabase Storage bucket 'seller-documents'
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    status document_verification_status NOT NULL DEFAULT 'PENDING',
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable Row Level Security
ALTER TABLE public.seller_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Seller Agreements
CREATE POLICY "Sellers can view own agreements"
    ON public.seller_agreements
    FOR SELECT
    USING (
        public.is_seller_member(seller_id, auth.uid()) OR public.is_admin(auth.uid())
    );

CREATE POLICY "Sellers can record agreement acceptance"
    ON public.seller_agreements
    FOR INSERT
    WITH CHECK (
        public.is_seller_member(seller_id, auth.uid()) OR public.is_admin(auth.uid())
    );

-- 6. RLS Policies for Seller Documents
CREATE POLICY "Sellers can view own documents"
    ON public.seller_documents
    FOR SELECT
    USING (
        public.is_seller_member(seller_id, auth.uid()) OR public.is_admin(auth.uid())
    );

CREATE POLICY "Sellers can upload own documents"
    ON public.seller_documents
    FOR INSERT
    WITH CHECK (
        public.is_seller_member(seller_id, auth.uid())
    );

CREATE POLICY "Admins can manage and verify seller documents"
    ON public.seller_documents
    FOR ALL
    USING (
        public.is_admin(auth.uid())
    );

-- 7. Indexes for Fast Identity and Compliance Lookups
CREATE INDEX IF NOT EXISTS idx_seller_agreements_seller_id ON public.seller_agreements(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_documents_seller_id ON public.seller_documents(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_documents_status ON public.seller_documents(status);
