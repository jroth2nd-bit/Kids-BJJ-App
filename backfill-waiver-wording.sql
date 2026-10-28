-- One-time backfill: store the current waiver wording on waivers signed before wording was tracked.
-- Only waivers with no stored wording are touched. Run in the Supabase SQL Editor (no sign-in user, so the lock does not apply).
-- The wording below is identical to what the waiver page stores for new signatures.

-- STEP 1: Preview. Shows how many waivers will be updated.
select s.program, count(*) as waivers_without_wording
from public.waivers w join public.students s on s.id = w.student_id
where w.waiver_text is null or w.waiver_text = ''
group by s.program;

-- STEP 2: Apply.
update public.waivers w
set waiver_text = case when s.program = 'kids' then $wording$In consideration of being permitted to participate in any way, including travel to and from Black Lotus Brazilian Jiu Jitsu Academy LLP, I hereby:

1. Acknowledge that the term “Activity” will refer to any and all training in jiu jitsu, grappling, striking self-defense, boxing/kickboxing, yoga, or any seminar produced by Black Lotus Brazilian Jiu Jitsu Academy LLP or its agents or held at the location of Black Lotus Brazilian Jiu Jitsu Academy.

2. Acknowledge that I am familiar with the sports and activities of jiu jitsu, grappling, boxing/kickboxing, and yoga and understand the rules governing these sports and activities.

3. Agree that, prior to participating, I will inspect the mats, equipment, training area, and facilities and, if I believe anything is unsafe or beyond my capability, I will immediately advise representatives of Black Lotus Brazilian Jiu Jitsu Academy LLP and refuse to participate.

4. In consideration of the risk of injury while participating in the Activity, and as consideration for the right to participate, I hereby, for myself, my heirs, executors, administrators, assigns, or personal representatives, knowingly and voluntarily enter into this waiver and release of liability and waive any and all rights, claims, or causes of action arising out of my participation. I release and forever discharge Black Lotus Brazilian Jiu Jitsu Academy LLP, located at 22241 Lorain Rd., Fairview Park, OH 44126, and its affiliates, managers, members, agents, attorneys, staff, volunteers, heirs, representatives, predecessors, successors, and assigns from any physical or psychological injury or loss that I may suffer as a direct result of my participation, including travel to and from an event related to this Activity.

5. I AM VOLUNTARILY PARTICIPATING IN THE AFOREMENTIONED ACTIVITY AND I AM PARTICIPATING IN THE ACTIVITY ENTIRELY AT MY OWN RISK. I AM AWARE OF THE RISKS ASSOCIATED WITH TRAVELING TO AND FROM AS WELL AS PARTICIPATING IN THIS ACTIVITY, WHICH MAY INCLUDE, BUT ARE NOT LIMITED TO, PHYSICAL OR PSYCHOLOGICAL INJURY, PAIN, SUFFERING, ILLNESS, DISFIGUREMENT, TEMPORARY OR PERMANENT DISABILITY (INCLUDING PARALYSIS), TRAUMATIC BRAIN INJURY, ECONOMIC OR EMOTIONAL LOSS, AND DEATH. I UNDERSTAND THAT THESE INJURIES OR OUTCOMES MAY ARISE FROM MY OWN OR OTHERS’ NEGLIGENCE, CONDITIONS RELATED TO TRAVEL, OR THE CONDITION OF THE ACTIVITY LOCATION(S). NONETHELESS, I ASSUME ALL RELATED RISKS, BOTH KNOWN AND UNKNOWN TO ME, OF MY PARTICIPATION.

6. I agree to indemnify and hold harmless Black Lotus Brazilian Jiu Jitsu Academy LLP and its agents against any and all claims, suits, or actions of any kind for liability, damages, compensation, or otherwise brought by me or anyone on my behalf, including attorney’s fees and related costs. If Black Lotus Brazilian Jiu Jitsu Academy LLP incurs these expenses, I agree to reimburse it.

I HAVE READ THE ABOVE WARNING, WAIVER, AND RELEASE, UNDERSTANDING THAT I GIVE UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND KNOWING THIS, SIGN IT VOLUNTARILY. I AGREE TO PARTICIPATE KNOWING THE RISKS AND CONDITIONS INVOLVED AND DO SO ENTIRELY ON MY OWN FREE WILL. I AFFIRM THAT I AM AT LEAST 18 YEARS OF AGE, OR, IF I AM UNDER 18 YEARS OF AGE, I HAVE OBTAINED THE REQUIRED CONSENT OF MY PARENT/GUARDIAN AS EVIDENCED BY THEIR SIGNATURE BELOW.

FOR PARENTS/GUARDIANS OF PARTICIPANTS OF MINORITY AGE

This is to certify that I, as parent/guardian with legal responsibility for this participant, consent and agree to the release provided above. For myself, my heirs, assigns, and next of kin, I release and agree to indemnify and hold harmless the releasees from liabilities incident to my minor child’s participation, even if arising from their negligence, to the fullest extent permitted by law. I have instructed the minor participant as to the above warnings and conditions and their consequences.$wording$ else $wording$In consideration of being permitted to participate in any way, including travel to and from Black Lotus Brazilian Jiu Jitsu Academy LLP, I hereby:

1. Acknowledge that the term “Activity” will refer to any and all training in jiu jitsu, grappling, striking self-defense, boxing/kickboxing, yoga, or any seminar produced by Black Lotus Brazilian Jiu Jitsu Academy LLP or its agents or held at the location of Black Lotus Brazilian Jiu Jitsu Academy.

2. Acknowledge that I am familiar with the sports and activities of jiu jitsu, grappling, boxing/kickboxing, and yoga and understand the rules governing these sports and activities.

3. Agree that, prior to participating, I will inspect the mats, equipment, training area, and facilities and, if I believe anything is unsafe or beyond my capability, I will immediately advise representatives of Black Lotus Brazilian Jiu Jitsu Academy LLP and refuse to participate.

4. In consideration of the risk of injury while participating in the Activity, and as consideration for the right to participate, I hereby, for myself, my heirs, executors, administrators, assigns, or personal representatives, knowingly and voluntarily enter into this waiver and release of liability and waive any and all rights, claims, or causes of action arising out of my participation. I release and forever discharge Black Lotus Brazilian Jiu Jitsu Academy LLP, located at 22241 Lorain Rd., Fairview Park, OH 44126, and its affiliates, managers, members, agents, attorneys, staff, volunteers, heirs, representatives, predecessors, successors, and assigns from any physical or psychological injury or loss that I may suffer as a direct result of my participation, including travel to and from an event related to this Activity.

5. I AM VOLUNTARILY PARTICIPATING IN THE AFOREMENTIONED ACTIVITY AND I AM PARTICIPATING IN THE ACTIVITY ENTIRELY AT MY OWN RISK. I AM AWARE OF THE RISKS ASSOCIATED WITH TRAVELING TO AND FROM AS WELL AS PARTICIPATING IN THIS ACTIVITY, WHICH MAY INCLUDE, BUT ARE NOT LIMITED TO, PHYSICAL OR PSYCHOLOGICAL INJURY, PAIN, SUFFERING, ILLNESS, DISFIGUREMENT, TEMPORARY OR PERMANENT DISABILITY (INCLUDING PARALYSIS), TRAUMATIC BRAIN INJURY, ECONOMIC OR EMOTIONAL LOSS, AND DEATH. I UNDERSTAND THAT THESE INJURIES OR OUTCOMES MAY ARISE FROM MY OWN OR OTHERS’ NEGLIGENCE, CONDITIONS RELATED TO TRAVEL, OR THE CONDITION OF THE ACTIVITY LOCATION(S). NONETHELESS, I ASSUME ALL RELATED RISKS, BOTH KNOWN AND UNKNOWN TO ME, OF MY PARTICIPATION.

6. I agree to indemnify and hold harmless Black Lotus Brazilian Jiu Jitsu Academy LLP and its agents against any and all claims, suits, or actions of any kind for liability, damages, compensation, or otherwise brought by me or anyone on my behalf, including attorney’s fees and related costs. If Black Lotus Brazilian Jiu Jitsu Academy LLP incurs these expenses, I agree to reimburse it.

I HAVE READ THE ABOVE WARNING, WAIVER, AND RELEASE, UNDERSTANDING THAT I GIVE UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND KNOWING THIS, SIGN IT VOLUNTARILY. I AGREE TO PARTICIPATE KNOWING THE RISKS AND CONDITIONS INVOLVED AND DO SO ENTIRELY ON MY OWN FREE WILL. I AFFIRM THAT I AM AT LEAST 18 YEARS OF AGE, OR, IF I AM UNDER 18 YEARS OF AGE, I HAVE OBTAINED THE REQUIRED CONSENT OF MY PARENT/GUARDIAN AS EVIDENCED BY THEIR SIGNATURE BELOW.$wording$ end,
    waiver_text_sha256 = encode(sha256(convert_to(case when s.program = 'kids' then $wording$In consideration of being permitted to participate in any way, including travel to and from Black Lotus Brazilian Jiu Jitsu Academy LLP, I hereby:

1. Acknowledge that the term “Activity” will refer to any and all training in jiu jitsu, grappling, striking self-defense, boxing/kickboxing, yoga, or any seminar produced by Black Lotus Brazilian Jiu Jitsu Academy LLP or its agents or held at the location of Black Lotus Brazilian Jiu Jitsu Academy.

2. Acknowledge that I am familiar with the sports and activities of jiu jitsu, grappling, boxing/kickboxing, and yoga and understand the rules governing these sports and activities.

3. Agree that, prior to participating, I will inspect the mats, equipment, training area, and facilities and, if I believe anything is unsafe or beyond my capability, I will immediately advise representatives of Black Lotus Brazilian Jiu Jitsu Academy LLP and refuse to participate.

4. In consideration of the risk of injury while participating in the Activity, and as consideration for the right to participate, I hereby, for myself, my heirs, executors, administrators, assigns, or personal representatives, knowingly and voluntarily enter into this waiver and release of liability and waive any and all rights, claims, or causes of action arising out of my participation. I release and forever discharge Black Lotus Brazilian Jiu Jitsu Academy LLP, located at 22241 Lorain Rd., Fairview Park, OH 44126, and its affiliates, managers, members, agents, attorneys, staff, volunteers, heirs, representatives, predecessors, successors, and assigns from any physical or psychological injury or loss that I may suffer as a direct result of my participation, including travel to and from an event related to this Activity.

5. I AM VOLUNTARILY PARTICIPATING IN THE AFOREMENTIONED ACTIVITY AND I AM PARTICIPATING IN THE ACTIVITY ENTIRELY AT MY OWN RISK. I AM AWARE OF THE RISKS ASSOCIATED WITH TRAVELING TO AND FROM AS WELL AS PARTICIPATING IN THIS ACTIVITY, WHICH MAY INCLUDE, BUT ARE NOT LIMITED TO, PHYSICAL OR PSYCHOLOGICAL INJURY, PAIN, SUFFERING, ILLNESS, DISFIGUREMENT, TEMPORARY OR PERMANENT DISABILITY (INCLUDING PARALYSIS), TRAUMATIC BRAIN INJURY, ECONOMIC OR EMOTIONAL LOSS, AND DEATH. I UNDERSTAND THAT THESE INJURIES OR OUTCOMES MAY ARISE FROM MY OWN OR OTHERS’ NEGLIGENCE, CONDITIONS RELATED TO TRAVEL, OR THE CONDITION OF THE ACTIVITY LOCATION(S). NONETHELESS, I ASSUME ALL RELATED RISKS, BOTH KNOWN AND UNKNOWN TO ME, OF MY PARTICIPATION.

6. I agree to indemnify and hold harmless Black Lotus Brazilian Jiu Jitsu Academy LLP and its agents against any and all claims, suits, or actions of any kind for liability, damages, compensation, or otherwise brought by me or anyone on my behalf, including attorney’s fees and related costs. If Black Lotus Brazilian Jiu Jitsu Academy LLP incurs these expenses, I agree to reimburse it.

I HAVE READ THE ABOVE WARNING, WAIVER, AND RELEASE, UNDERSTANDING THAT I GIVE UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND KNOWING THIS, SIGN IT VOLUNTARILY. I AGREE TO PARTICIPATE KNOWING THE RISKS AND CONDITIONS INVOLVED AND DO SO ENTIRELY ON MY OWN FREE WILL. I AFFIRM THAT I AM AT LEAST 18 YEARS OF AGE, OR, IF I AM UNDER 18 YEARS OF AGE, I HAVE OBTAINED THE REQUIRED CONSENT OF MY PARENT/GUARDIAN AS EVIDENCED BY THEIR SIGNATURE BELOW.

FOR PARENTS/GUARDIANS OF PARTICIPANTS OF MINORITY AGE

This is to certify that I, as parent/guardian with legal responsibility for this participant, consent and agree to the release provided above. For myself, my heirs, assigns, and next of kin, I release and agree to indemnify and hold harmless the releasees from liabilities incident to my minor child’s participation, even if arising from their negligence, to the fullest extent permitted by law. I have instructed the minor participant as to the above warnings and conditions and their consequences.$wording$ else $wording$In consideration of being permitted to participate in any way, including travel to and from Black Lotus Brazilian Jiu Jitsu Academy LLP, I hereby:

1. Acknowledge that the term “Activity” will refer to any and all training in jiu jitsu, grappling, striking self-defense, boxing/kickboxing, yoga, or any seminar produced by Black Lotus Brazilian Jiu Jitsu Academy LLP or its agents or held at the location of Black Lotus Brazilian Jiu Jitsu Academy.

2. Acknowledge that I am familiar with the sports and activities of jiu jitsu, grappling, boxing/kickboxing, and yoga and understand the rules governing these sports and activities.

3. Agree that, prior to participating, I will inspect the mats, equipment, training area, and facilities and, if I believe anything is unsafe or beyond my capability, I will immediately advise representatives of Black Lotus Brazilian Jiu Jitsu Academy LLP and refuse to participate.

4. In consideration of the risk of injury while participating in the Activity, and as consideration for the right to participate, I hereby, for myself, my heirs, executors, administrators, assigns, or personal representatives, knowingly and voluntarily enter into this waiver and release of liability and waive any and all rights, claims, or causes of action arising out of my participation. I release and forever discharge Black Lotus Brazilian Jiu Jitsu Academy LLP, located at 22241 Lorain Rd., Fairview Park, OH 44126, and its affiliates, managers, members, agents, attorneys, staff, volunteers, heirs, representatives, predecessors, successors, and assigns from any physical or psychological injury or loss that I may suffer as a direct result of my participation, including travel to and from an event related to this Activity.

5. I AM VOLUNTARILY PARTICIPATING IN THE AFOREMENTIONED ACTIVITY AND I AM PARTICIPATING IN THE ACTIVITY ENTIRELY AT MY OWN RISK. I AM AWARE OF THE RISKS ASSOCIATED WITH TRAVELING TO AND FROM AS WELL AS PARTICIPATING IN THIS ACTIVITY, WHICH MAY INCLUDE, BUT ARE NOT LIMITED TO, PHYSICAL OR PSYCHOLOGICAL INJURY, PAIN, SUFFERING, ILLNESS, DISFIGUREMENT, TEMPORARY OR PERMANENT DISABILITY (INCLUDING PARALYSIS), TRAUMATIC BRAIN INJURY, ECONOMIC OR EMOTIONAL LOSS, AND DEATH. I UNDERSTAND THAT THESE INJURIES OR OUTCOMES MAY ARISE FROM MY OWN OR OTHERS’ NEGLIGENCE, CONDITIONS RELATED TO TRAVEL, OR THE CONDITION OF THE ACTIVITY LOCATION(S). NONETHELESS, I ASSUME ALL RELATED RISKS, BOTH KNOWN AND UNKNOWN TO ME, OF MY PARTICIPATION.

6. I agree to indemnify and hold harmless Black Lotus Brazilian Jiu Jitsu Academy LLP and its agents against any and all claims, suits, or actions of any kind for liability, damages, compensation, or otherwise brought by me or anyone on my behalf, including attorney’s fees and related costs. If Black Lotus Brazilian Jiu Jitsu Academy LLP incurs these expenses, I agree to reimburse it.

I HAVE READ THE ABOVE WARNING, WAIVER, AND RELEASE, UNDERSTANDING THAT I GIVE UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND KNOWING THIS, SIGN IT VOLUNTARILY. I AGREE TO PARTICIPATE KNOWING THE RISKS AND CONDITIONS INVOLVED AND DO SO ENTIRELY ON MY OWN FREE WILL. I AFFIRM THAT I AM AT LEAST 18 YEARS OF AGE, OR, IF I AM UNDER 18 YEARS OF AGE, I HAVE OBTAINED THE REQUIRED CONSENT OF MY PARENT/GUARDIAN AS EVIDENCED BY THEIR SIGNATURE BELOW.$wording$ end, 'UTF8')), 'hex')
from public.students s
where s.id = w.student_id and (w.waiver_text is null or w.waiver_text = '');

-- STEP 3: Verify. Every waiver should show a hash; adult and kids hashes should each be a single value.
select s.program, count(*) as waivers, count(distinct w.waiver_text_sha256) as distinct_hashes,
       count(*) filter (where w.waiver_text_sha256 is null) as missing
from public.waivers w join public.students s on s.id = w.student_id
group by s.program;
