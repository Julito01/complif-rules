/**
 * Faculty codes - standardized permissions that require authorization.
 * These represent actions that signers can approve.
 */
export enum FacultyCode {
  CREATE_WIRE = 'CREATE_WIRE',
  APPROVE_WIRE = 'APPROVE_WIRE',
  REQUEST_LOAN = 'REQUEST_LOAN',
  APPROVE_LOAN = 'APPROVE_LOAN',
  MODIFY_CONTACT_INFO = 'MODIFY_CONTACT_INFO',
  VIEW_STATEMENTS = 'VIEW_STATEMENTS',
  MANAGE_SIGNERS = 'MANAGE_SIGNERS',
}
