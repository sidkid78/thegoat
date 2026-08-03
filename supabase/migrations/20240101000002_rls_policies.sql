-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 20250101000002_rls_policies.sql
-- Enforces data protection at the database level for client & server components.
-- ============================================================================

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cma_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. PROPERTIES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Active properties are viewable by everyone"
  ON public.properties FOR SELECT
  TO public
  USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY "Sellers and Agents can insert properties"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('seller', 'agent', 'admin')
    )
  );

CREATE POLICY "Owners can update their properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their properties"
  ON public.properties FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- 3. PROPERTY VECTORS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Property vectors are readable by everyone"
  ON public.property_vectors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Property vectors can be inserted by property owner or system"
  ON public.property_vectors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. CMA REPORTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own generated CMAs or CMAs for their properties"
  ON public.cma_reports FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can request and store CMA reports"
  ON public.cma_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. OFFERS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Buyers can view their submitted offers; Sellers can view offers on their properties"
  ON public.offers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can submit offers"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers or Sellers can update offer status"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = buyer_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 6. VIEWINGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their viewings; Sellers can view tours on their listings"
  ON public.viewings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can schedule viewings"
  ON public.viewings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify or cancel viewings"
  ON public.viewings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. FAVORITES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their favorites"
  ON public.favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
  ON public.favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
  ON public.favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);