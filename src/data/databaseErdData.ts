export type ErdCategory = 'core' | 'infrastructure' | 'mileage' | 'authentication'

export type ErdFieldKey = 'PK' | 'FK' | 'UQ'

export type ErdField = {
  name: string
  type: string
  description: string
  keys?: ErdFieldKey[]
  reference?: string
}

export type ErdTable = {
  id: string
  label: string
  category: ErdCategory
  fields: ErdField[]
  uniqueConstraints?: string[][]
}

export type ErdRelation = {
  id: string
  sourceTableId: string
  sourceFields: string[]
  targetTableId: string
  targetFields: string[]
  onDelete: 'CASCADE' | 'RESTRICT'
}

export const erdCategoryLabels: Record<ErdCategory, string> = {
  core: '기본 정보',
  infrastructure: '인프라',
  mileage: '마일리지·정산',
  authentication: '인증',
}

export const erdTables: ErdTable[] = [
  {
    id: 'logistics_companies',
    label: '물류사',
    category: 'core',
    fields: [
      { name: 'id', type: 'TEXT', description: '물류사 식별자', keys: ['PK'] },
      { name: 'business_name', type: 'TEXT', description: '사업자명' },
      { name: 'business_number', type: 'TEXT', description: '사업자번호', keys: ['UQ'] },
      { name: 'corporate_registration_number', type: 'TEXT', description: '법인등록번호', keys: ['UQ'] },
      { name: 'business_address', type: 'TEXT', description: '사업장소재지' },
      { name: 'manager_name', type: 'TEXT', description: '담당자명' },
      { name: 'manager_phone', type: 'TEXT', description: '담당자 연락처' },
      { name: 'bank_code', type: 'TEXT', description: '정산 계좌 은행 코드' },
      { name: 'account_number', type: 'TEXT', description: '정산 계좌번호' },
      { name: 'account_holder', type: 'TEXT', description: '정산 계좌 예금주' },
      { name: 'active', type: 'INTEGER', description: '운영 여부' },
      { name: 'created_at', type: 'TIMESTAMP', description: '등록일시' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'users',
    label: '사용자',
    category: 'core',
    fields: [
      { name: 'id', type: 'TEXT', description: '사용자 식별자', keys: ['PK'] },
      { name: 'role', type: 'TEXT', description: '계정 역할(관리자·기사)' },
      { name: 'email', type: 'TEXT', description: "로그인 이메일 · 조건부 고유: deactivated_at IS NULL OR role = 'admin' (탈퇴 기사 제외)" },
      { name: 'password_hash', type: 'TEXT', description: '비밀번호 해시' },
      { name: 'name', type: 'TEXT', description: '사용자 이름' },
      { name: 'phone', type: 'TEXT', description: "연락처 · 조건부 고유: deactivated_at IS NULL OR role = 'admin' (탈퇴 기사 제외)" },
      {
        name: 'logistics_company_id',
        type: 'TEXT',
        description: '소속 물류사 식별자',
        keys: ['FK'],
        reference: 'logistics_companies.id',
      },
      { name: 'service_terms_consent', type: 'BOOLEAN', description: '서비스 이용약관 동의 여부' },
      { name: 'privacy_terms_consent', type: 'BOOLEAN', description: '개인정보 수집·이용 동의 여부' },
      { name: 'marketing_consent', type: 'BOOLEAN', description: '마케팅 수신 동의 여부' },
      { name: 'deactivated_at', type: 'TIMESTAMP', description: '탈퇴·비활성 일시' },
      { name: 'created_at', type: 'TIMESTAMP', description: '가입일시' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'installation_sites',
    label: '주유소',
    category: 'infrastructure',
    fields: [
      { name: 'id', type: 'TEXT', description: '설치처 식별자', keys: ['PK'] },
      { name: 'pole', type: 'TEXT', description: '주유소 Pole(브랜드)' },
      { name: 'business_name', type: 'TEXT', description: '주유소명·업체명' },
      { name: 'road_address', type: 'TEXT', description: '도로명 주소' },
      { name: 'note', type: 'TEXT', description: '비고' },
      { name: 'latitude', type: 'REAL', description: '위도' },
      { name: 'longitude', type: 'REAL', description: '경도' },
      { name: 'coordinate_source', type: 'TEXT', description: '좌표 확보 경로' },
      { name: 'coordinate_verified_at', type: 'TIMESTAMP', description: '좌표 검증 시각' },
      { name: 'active', type: 'INTEGER', description: '운영 여부' },
      { name: 'created_at', type: 'TIMESTAMP', description: '등록일시' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'installation_site_devices',
    label: '주유소 기기',
    category: 'infrastructure',
    fields: [
      { name: 'id', type: 'TEXT', description: '기기 식별자', keys: ['PK'] },
      {
        name: 'installation_site_id',
        type: 'TEXT',
        description: '설치처 식별자',
        keys: ['FK'],
        reference: 'installation_sites.id',
      },
      { name: 'model', type: 'TEXT', description: '기기 모델명' },
      { name: 'capacity_liters', type: 'INTEGER', description: '기기 용량(L)' },
      { name: 'active', type: 'INTEGER', description: '운영 여부' },
      { name: 'created_at', type: 'TIMESTAMP', description: '등록일시' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'settlements',
    label: '물류사 정산',
    category: 'mileage',
    uniqueConstraints: [
      ['logistics_company_id', 'settlement_month'],
      ['id', 'logistics_company_id'],
    ],
    fields: [
      { name: 'id', type: 'TEXT', description: '정산 식별자', keys: ['PK'] },
      {
        name: 'logistics_company_id',
        type: 'TEXT',
        description: '정산 대상 물류사 식별자',
        keys: ['FK'],
        reference: 'logistics_companies.id',
      },
      { name: 'settlement_month', type: 'TEXT', description: '정산 대상 월(YYYY-MM)' },
      { name: 'transfer_status', type: 'TEXT', description: '이체 상태(이체대기·이체완료)' },
      { name: 'transferred_at', type: 'TIMESTAMP', description: '이체 완료일시' },
      { name: 'created_at', type: 'TIMESTAMP', description: '등록일시' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'mileage_applications',
    label: '마일리지 신청',
    category: 'mileage',
    uniqueConstraints: [['user_id', 'idempotency_key']],
    fields: [
      { name: 'id', type: 'TEXT', description: '마일리지 신청 식별자', keys: ['PK'] },
      { name: 'user_id', type: 'TEXT', description: '신청 기사 식별자', keys: ['FK'], reference: 'users.id' },
      {
        name: 'logistics_company_id',
        type: 'TEXT',
        description: '신청 당시 소속 물류사 식별자',
        keys: ['FK'],
        reference: 'logistics_companies.id',
      },
      { name: 'idempotency_key', type: 'TEXT', description: '중복 신청 방지 키' },
      { name: 'receipt_amount', type: 'INTEGER', description: '영수증 금액' },
      { name: 'meter_amount', type: 'INTEGER', description: '계기판 금액' },
      { name: 'final_amount', type: 'INTEGER', description: '승인 확정 금액' },
      { name: 'mileage_amount', type: 'INTEGER', description: '지급 마일리지' },
      { name: 'receipt_at', type: 'TIMESTAMP', description: '영수 일시' },
      {
        name: 'match_status',
        type: 'TEXT',
        description: '금액 일치 상태(대기·일치·불일치·OCR 실패·중복 의심)',
      },
      { name: 'approval_status', type: 'TEXT', description: '관리자 승인 상태(대기·승인·반려)' },
      { name: 'rejection_reason', type: 'TEXT', description: '반려 사유' },
      {
        name: 'settlement_id',
        type: 'TEXT',
        description: '물류사 ID와 함께 동일 물류사 정산을 참조하는 정산 ID',
        keys: ['FK'],
        reference: 'settlements.(id, logistics_company_id) 복합 FK',
      },
      { name: 'submitted_at', type: 'TIMESTAMP', description: '신청 시각' },
      { name: 'decided_at', type: 'TIMESTAMP', description: '승인·반려 결정 시각' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'mileage_application_photos',
    label: '신청 사진',
    category: 'mileage',
    uniqueConstraints: [['mileage_application_id', 'kind']],
    fields: [
      { name: 'id', type: 'TEXT', description: '사진 식별자', keys: ['PK'] },
      {
        name: 'mileage_application_id',
        type: 'TEXT',
        description: '연결된 마일리지 신청 식별자',
        keys: ['FK'],
        reference: 'mileage_applications.id',
      },
      { name: 'kind', type: 'TEXT', description: '사진 구분(영수증·계기판)' },
      { name: 'storage_key', type: 'TEXT', description: '파일 저장 키', keys: ['UQ'] },
      { name: 'content_type', type: 'TEXT', description: '파일 MIME 유형' },
      { name: 'byte_size', type: 'INTEGER', description: '파일 크기(Byte)' },
      { name: 'uploaded_at', type: 'TIMESTAMP', description: '사진 업로드 시각' },
      { name: 'updated_at', type: 'TIMESTAMP', description: '수정일시' },
    ],
  },
  {
    id: 'phone_verifications',
    label: '휴대폰 인증',
    category: 'authentication',
    fields: [
      { name: 'id', type: 'TEXT', description: '휴대폰 인증 식별자', keys: ['PK'] },
      {
        name: 'purpose',
        type: 'TEXT',
        description: '인증 목적(회원가입·이메일 찾기·비밀번호 재설정·연락처 변경)',
      },
      { name: 'phone', type: 'TEXT', description: '인증 대상 휴대폰 번호' },
      { name: 'scope_email', type: 'TEXT', description: '인증 범위 이메일(비밀번호 재설정 시 사용)' },
      { name: 'scope_user_id', type: 'TEXT', description: '인증 범위의 본인 사용자 식별자(연락처 변경 시 사용)', keys: ['FK'], reference: 'users.id' },
      { name: 'code_hash', type: 'TEXT', description: '인증번호 해시' },
      { name: 'proof_hash', type: 'TEXT', description: '서버 발급 인증 증명 해시', keys: ['UQ'] },
      { name: 'expires_at', type: 'TIMESTAMP', description: '인증 만료 시각' },
      { name: 'verified_at', type: 'TIMESTAMP', description: '인증 완료 시각' },
      { name: 'consumed_at', type: 'TIMESTAMP', description: '인증 증명 사용 시각' },
      { name: 'invalidated_at', type: 'TIMESTAMP', description: '인증 무효 시각' },
      { name: 'created_at', type: 'TIMESTAMP', description: '인증 요청 시각' },
    ],
  },
  {
    id: 'password_reset_tokens',
    label: '비밀번호 재설정 토큰',
    category: 'authentication',
    fields: [
      { name: 'id', type: 'TEXT', description: '재설정 토큰 식별자', keys: ['PK'] },
      { name: 'user_id', type: 'TEXT', description: '재설정 대상 사용자 식별자', keys: ['FK'], reference: 'users.id' },
      { name: 'token_hash', type: 'TEXT', description: '재설정 토큰 해시', keys: ['UQ'] },
      { name: 'expires_at', type: 'TIMESTAMP', description: '토큰 만료 시각' },
      { name: 'used_at', type: 'TIMESTAMP', description: '토큰 사용 완료 시각' },
      { name: 'created_at', type: 'TIMESTAMP', description: '토큰 발급 시각' },
    ],
  },
  {
    id: 'auth_sessions',
    label: '기사 로그인 세션',
    category: 'authentication',
    fields: [
      { name: 'token_hash', type: 'TEXT', description: '세션 토큰 SHA-256 해시', keys: ['PK'] },
      { name: 'user_id', type: 'TEXT', description: '로그인 기사 식별자', keys: ['FK'], reference: 'users.id' },
      { name: 'created_at', type: 'INTEGER', description: '로그인 시각(UTC Unix 밀리초)' },
      { name: 'last_used_at', type: 'INTEGER', description: '마지막 정상 인증 요청 시각(UTC Unix 밀리초)' },
      { name: 'expires_at', type: 'INTEGER', description: '최대 세션 만료 시각(UTC Unix 밀리초)' },
    ],
  },
  {
    id: 'admin_sessions',
    label: '관리자 로그인 세션',
    category: 'authentication',
    fields: [
      { name: 'token_hash', type: 'TEXT', description: '세션 토큰 SHA-256 해시', keys: ['PK'] },
      { name: 'user_id', type: 'TEXT', description: '로그인 관리자 식별자', keys: ['FK'], reference: 'users.id' },
      { name: 'created_at', type: 'INTEGER', description: '로그인 시각(UTC Unix 밀리초)' },
      { name: 'expires_at', type: 'INTEGER', description: '세션 만료 시각(UTC Unix 밀리초)' },
    ],
  },
]

export const erdRelations: ErdRelation[] = [
  {
    id: 'logistics-companies-users',
    sourceTableId: 'logistics_companies',
    sourceFields: ['id'],
    targetTableId: 'users',
    targetFields: ['logistics_company_id'],
    onDelete: 'RESTRICT',
  },
  {
    id: 'logistics-companies-settlements',
    sourceTableId: 'logistics_companies',
    sourceFields: ['id'],
    targetTableId: 'settlements',
    targetFields: ['logistics_company_id'],
    onDelete: 'RESTRICT',
  },
  {
    id: 'users-mileage-applications',
    sourceTableId: 'users',
    sourceFields: ['id'],
    targetTableId: 'mileage_applications',
    targetFields: ['user_id'],
    onDelete: 'RESTRICT',
  },
  {
    id: 'logistics-companies-mileage-applications',
    sourceTableId: 'logistics_companies',
    sourceFields: ['id'],
    targetTableId: 'mileage_applications',
    targetFields: ['logistics_company_id'],
    onDelete: 'RESTRICT',
  },
  {
    id: 'settlements-mileage-applications',
    sourceTableId: 'settlements',
    sourceFields: ['id', 'logistics_company_id'],
    targetTableId: 'mileage_applications',
    targetFields: ['settlement_id', 'logistics_company_id'],
    onDelete: 'RESTRICT',
  },
  {
    id: 'mileage-applications-photos',
    sourceTableId: 'mileage_applications',
    sourceFields: ['id'],
    targetTableId: 'mileage_application_photos',
    targetFields: ['mileage_application_id'],
    onDelete: 'CASCADE',
  },
  {
    id: 'installation-sites-devices',
    sourceTableId: 'installation_sites',
    sourceFields: ['id'],
    targetTableId: 'installation_site_devices',
    targetFields: ['installation_site_id'],
    onDelete: 'CASCADE',
  },
  {
    id: 'users-password-reset-tokens',
    sourceTableId: 'users',
    sourceFields: ['id'],
    targetTableId: 'password_reset_tokens',
    targetFields: ['user_id'],
    onDelete: 'CASCADE',
  },
  {
    id: 'users-auth-sessions',
    sourceTableId: 'users',
    sourceFields: ['id'],
    targetTableId: 'auth_sessions',
    targetFields: ['user_id'],
    onDelete: 'CASCADE',
  },
  {
    id: 'users-admin-sessions',
    sourceTableId: 'users',
    sourceFields: ['id'],
    targetTableId: 'admin_sessions',
    targetFields: ['user_id'],
    onDelete: 'CASCADE',
  },
  {
    id: 'users-phone-verifications',
    sourceTableId: 'users',
    sourceFields: ['id'],
    targetTableId: 'phone_verifications',
    targetFields: ['scope_user_id'],
    onDelete: 'CASCADE',
  },
]
